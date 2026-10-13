import dgram from 'dgram';
import { DEFAULT_UDP_PORT } from '../../shared/constants.js';
import { configManager } from '../config/config.manager.js';
import {
  getLocalIpAddress,
  getBonjourHost,
  getBonjourUrl,
} from './ip.service.js';
import { networkWatcherService } from './network-watcher.service.js';

export class UdpDiscoveryService {
  private socket: dgram.Socket | null = null;
  private isListening: boolean = false;
  private port: number = DEFAULT_UDP_PORT;

  /**
   * 启动 UDP 局域网服务自发现与广播信标
   */
  public start(port: number = DEFAULT_UDP_PORT): void {
    if (this.isListening) return;
    this.port = port;

    const settings = configManager.getSettings();
    if (settings.enableUdpDiscovery === false) {
      console.log('[UDP] Discovery service disabled in settings.');
      return;
    }

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', (err) => {
        console.warn('[UDP] Discovery socket error:', err.message);
        try {
          this.socket?.close();
        } catch (_) {}
        this.isListening = false;
      });

      this.socket.on('message', (msg, rinfo) => {
        const text = msg.toString().trim();
        // 匹配任意包含 DISCOVER, PING, LIGHTDROP 的嗅探请求
        if (
          text.includes('DISCOVER') ||
          text.includes('PING') ||
          text.includes('LIGHTDROP')
        ) {
          this.respondToClient(rinfo);
        }
      });

      this.socket.bind(this.port, () => {
        this.isListening = true;
        try {
          this.socket?.setBroadcast(true);
        } catch (_) {}
        console.log(`[UDP] Discovery beacon listening on 0.0.0.0:${this.port}`);
        // 启动时主动广播一次信标
        this.broadcastAnnouncement();
      });

      // 监听网络变动事件，网络变更时自动广播新地址信标
      networkWatcherService.on('networkChanged', () => {
        this.broadcastAnnouncement();
      });
    } catch (err: any) {
      console.warn('[UDP] Failed to start discovery service:', err.message);
    }
  }

  /**
   * 获取当前服务宣告包
   */
  private getBeaconData(event: string = 'LIGHTDROP_ANNOUNCE'): string {
    const settings = configManager.getSettings();
    const httpPort = Number(process.env.PORT) || settings.port || 8080;
    const ip = getLocalIpAddress();
    const bonjourHost = getBonjourHost();
    const bonjourUrl = getBonjourUrl(httpPort);
    const url = `http://${ip}:${httpPort}`;

    return JSON.stringify({
      event,
      service: 'LightDrop',
      siteTitle: settings.siteTitle || 'LightDrop',
      ip,
      httpPort,
      url,
      bonjourHost,
      bonjourUrl,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 回复发起发现请求的局域网客户端
   */
  private respondToClient(rinfo: dgram.RemoteInfo): void {
    if (!this.socket || !this.isListening) return;

    try {
      const responseData = this.getBeaconData('LIGHTDROP_PONG');
      const buffer = Buffer.from(responseData);
      this.socket.send(buffer, 0, buffer.length, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.warn('[UDP] Failed to send discovery response:', err.message);
        }
      });
    } catch (_) {}
  }

  /**
   * 向局域网全网广播信标
   */
  public broadcastAnnouncement(): void {
    if (!this.socket || !this.isListening) return;

    try {
      const data = this.getBeaconData('LIGHTDROP_ANNOUNCE');
      const buffer = Buffer.from(data);
      this.socket.send(buffer, 0, buffer.length, this.port, '255.255.255.255', (err) => {
        if (err) {
          // 局域网广播受防火墙限制时静默忽略
        }
      });
    } catch (_) {}
  }

  /**
   * 停止 UDP 发现服务
   */
  public stop(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (_) {}
      this.socket = null;
    }
    this.isListening = false;
  }
}

export const udpDiscoveryService = new UdpDiscoveryService();
