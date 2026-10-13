import { exec } from 'child_process';
import { EventEmitter } from 'events';
import { configManager } from '../config/config.manager.js';
import { wsService } from '../websocket/ws.server.js';
import {
  getLocalIpAddress,
  getNetworkSignature,
  getBonjourHost,
  getBonjourUrl,
  getAllNetworkIps,
} from './ip.service.js';
import { NetworkChangePayload } from '../../shared/types.js';

export class NetworkWatcherService extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private lastSignature: string = '';
  private lastPrimaryIp: string = '';
  private isChecking: boolean = false;
  private isStarted: boolean = false;

  /**
   * 启动局域网网络与 IP 变动侦测轮询
   */
  public start(intervalMs: number = 3000): void {
    if (this.isStarted) return;
    this.isStarted = true;

    this.lastSignature = getNetworkSignature();
    this.lastPrimaryIp = getLocalIpAddress();

    this.timer = setInterval(() => {
      this.checkNetworkChange().catch((err) => {
        console.warn('[NetworkWatcher] Check error:', err);
      });
    }, intervalMs);

    // 允许 Node 进程在没有其他事件时正常退出
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }

    console.log('[NetworkWatcher] Service started (monitoring network interfaces every 3s).');
  }

  /**
   * 停止侦测
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isStarted = false;
  }

  /**
   * 执行网络变动侦测与联动响应
   */
  public async checkNetworkChange(): Promise<boolean> {
    if (this.isChecking) return false;
    this.isChecking = true;

    try {
      const currentSignature = getNetworkSignature();
      if (!this.lastSignature) {
        this.lastSignature = currentSignature;
        this.lastPrimaryIp = getLocalIpAddress();
        return false;
      }

      if (currentSignature !== this.lastSignature) {
        const oldIp = this.lastPrimaryIp;
        const newIp = getLocalIpAddress();
        const settings = configManager.getSettings();
        const port = Number(process.env.PORT) || settings.port || 8080;
        const oldUrl = `http://${oldIp}:${port}`;
        const newUrl = `http://${newIp}:${port}`;
        const bonjourHost = getBonjourHost();
        const bonjourUrl = getBonjourUrl(port);
        const ipList = getAllNetworkIps(port, 'http', true);

        this.lastSignature = currentSignature;
        this.lastPrimaryIp = newIp;

        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡ LightDrop 网络环境与 IP 已发生切换！                   ║
║                                                              ║
║   ► 原访问地址:    ${oldUrl.padEnd(42)}║
║   ► 新局域网 IP:   ${newUrl.padEnd(42)}║
║   ► 稳定本地域名:  ${bonjourUrl.padEnd(42)}║
║                                                              ║
║   💡 手机端建议直接使用稳定域名访问，不受任何 Wi-Fi 切换影响。║
╚══════════════════════════════════════════════════════════════╝
        `);

        const payload: NetworkChangePayload = {
          oldIp,
          newIp,
          oldUrl,
          newUrl,
          bonjourUrl,
          ipList,
          timestamp: new Date().toISOString(),
        };

        // 1. WebSocket 广播网络变更事件
        wsService.broadcast('NETWORK_CHANGED', payload);

        // 2. 触发自定义事件
        this.emit('networkChanged', payload);

        // 3. 发送宿主机原生系统横幅通知 (跨平台支持 macOS / Windows / Linux)
        if (settings.enableMacNotification !== false) {
          this.sendDesktopNotification(
            'LightDrop · 网络与 IP 已切换',
            `新地址: ${newUrl}\n稳定域名: ${bonjourUrl}`
          );
        }

        // 4. 若配置了外部 Webhook 或 Bark 推送，立即向手机下发通知
        if (settings.webhookUrl && settings.webhookUrl.trim()) {
          this.sendWebhookNotification(
            settings.webhookUrl.trim(),
            '⚡ LightDrop IP 已更新',
            `新访问地址: ${newUrl} (稳定域名: ${bonjourUrl})`,
            newUrl
          ).catch((e) => {
            console.warn('[NetworkWatcher] Webhook notification failed:', e);
          });
        }

        return true;
      }

      return false;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 宿主机系统原生桌面横幅通知 (跨平台支持 macOS / Windows / Linux)
   */
  public sendDesktopNotification(title: string, body: string): void {
    const cleanTitle = title.replace(/["'\\]/g, ' ');
    const cleanBody = body.replace(/["'\\]/g, ' ');

    if (process.platform === 'darwin') {
      // macOS: 原生 osascript 通知中心
      try {
        const script = `display notification "${cleanBody}" with title "${cleanTitle}"`;
        exec(`osascript -e '${script}'`, (err) => {
          if (err) {
            console.warn('[NetworkWatcher] Mac notification error:', err.message);
          }
        });
      } catch (_) {}
    } else if (process.platform === 'win32') {
      // Windows: 原生 PowerShell BalloonTip / Toast 通知
      try {
        const singleLineBody = cleanBody.replace(/[\r\n]+/g, ' · ');
        const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null; $notify = New-Object System.Windows.Forms.NotifyIcon; $notify.Icon = [System.Drawing.SystemIcons]::Information; $notify.Visible = $true; $notify.ShowBalloonTip(6000, '${cleanTitle}', '${singleLineBody}', [System.Windows.Forms.ToolTipIcon]::Info);"`;
        exec(psCommand, (err) => {
          if (err) {
            console.warn('[NetworkWatcher] Windows notification error:', err.message);
          }
        });
      } catch (_) {}
    } else if (process.platform === 'linux') {
      // Linux: 通用 libnotify notify-send
      try {
        exec(`notify-send "${cleanTitle}" "${cleanBody}" -a "LightDrop"`, (err) => {
          if (err) {
            // Linux 无图形界面或未安装 libnotify 时静默忽略
          }
        });
      } catch (_) {}
    }
  }

  /**
   * 兼容旧接口别名
   */
  public sendMacNotification(title: string, body: string): void {
    this.sendDesktopNotification(title, body);
  }

  /**
   * 手机 Webhook / Bark 远程推送
   */
  public async sendWebhookNotification(
    webhookUrl: string,
    title: string,
    body: string,
    targetUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!webhookUrl || !webhookUrl.trim()) {
      return { success: false, message: 'Webhook URL 不能为空' };
    }

    const trimmedUrl = webhookUrl.trim();
    const isBark = /api\.day\.app/i.test(trimmedUrl);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      if (isBark) {
        // Bark 推送协议：支持 GET 或 POST
        // GET 形式：https://api.day.app/{key}/{title}/{body}?url={targetUrl}&group=LightDrop
        let barkEndpoint = trimmedUrl.replace(/\/+$/, '');
        const encodedTitle = encodeURIComponent(title);
        const encodedBody = encodeURIComponent(body);
        const encodedTargetUrl = targetUrl ? encodeURIComponent(targetUrl) : '';

        const fullBarkUrl = `${barkEndpoint}/${encodedTitle}/${encodedBody}?url=${encodedTargetUrl}&group=LightDrop&icon=https%3A%2F%2Fraw.githubusercontent.com%2Ffavicon.ico`;

        const res = await fetch(fullBarkUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          return { success: true, message: 'Bark 手机推送成功' };
        } else {
          return { success: false, message: `Bark 返回状态码: ${res.status}` };
        }
      } else {
        // 通用 Webhook POST (支持飞书/钉钉/企业微信/自定义网关)
        const res = await fetch(trimmedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            msg_type: 'text',
            content: { text: `${title}\n${body}\n${targetUrl || ''}` },
            title,
            body,
            text: `${title}\n${body}`,
            url: targetUrl,
            timestamp: Date.now(),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          return { success: true, message: 'Webhook 推送成功' };
        } else {
          return { success: false, message: `Webhook 返回状态码: ${res.status}` };
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.name === 'AbortError' ? '请求超时 (6秒未响应)' : (err.message || '网络请求错误'),
      };
    }
  }
}

export const networkWatcherService = new NetworkWatcherService();
