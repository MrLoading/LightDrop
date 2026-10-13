import http from 'http';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { wsService } from './websocket/ws.server.js';
import { configManager } from './config/config.manager.js';
import { cleanupService } from './services/cleanup.service.js';
import { getLocalIpAddress, getBonjourHost, getBonjourUrl } from './services/ip.service.js';
import { fileDatabase } from './database/file.database.js';
import { auditService } from './services/audit.service.js';
import { networkWatcherService } from './services/network-watcher.service.js';
import { udpDiscoveryService } from './services/udp-discovery.service.js';

dotenv.config();

const app = createApp();
const server = http.createServer(app);
server.timeout = 0; // 禁用大文件硬性超时
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;

// 初始化 WebSocket 服务
wsService.init(server);

// 启动定期清理任务
cleanupService.start();

// 启动网络变动与 IP 切换实时侦测服务
networkWatcherService.start();

// 启动 UDP 局域网广播自发现信标服务
udpDiscoveryService.start();

// 注册配置文件免重启热更新监听 (支持后台配置修改与实时生效)
configManager.on('reload', (newSettings, oldSettings) => {
  console.log('[Server] Settings reload detected. Applying changes dynamically...');
  if (oldSettings && newSettings.storageDir !== oldSettings.storageDir) {
    fileDatabase.reload();
    auditService.refreshPath();
  }
  cleanupService.runCleanup();
  wsService.broadcast('SETTINGS_UPDATED', newSettings);
  wsService.broadcast('STATS_UPDATED', fileDatabase.getStats());
});

const settings = configManager.getSettings();
const port = Number(process.env.PORT) || settings.port || 8080;
const host = '0.0.0.0';

server.listen(port, host, () => {
  const localIp = getLocalIpAddress();
  const bonjourHost = getBonjourHost();
  const bonjourUrl = getBonjourUrl(port);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡ LightDrop - 局域网快传服务已就绪 (100% TypeScript)      ║
║                                                              ║
║   ► 本地访问:    http://localhost:${port}                       ║
║   ► 局域网访问:  http://${localIp}:${port}                   ║
║   ► 稳定本地域名: ${bonjourUrl.padEnd(41)}║
║                  (🌟 手机推荐 / Wi-Fi切换IP不影响访问)       ║
║   ► 存储目录:    ${settings.storageDir}
║                                                              ║
║   同局域网设备打开上述链接即可免登录互传文本与文件。         ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

// 优雅停机
const handleShutdown = () => {
  console.log('\nShutting down LightDrop gracefully...');
  cleanupService.stop();
  wsService.stop();
  networkWatcherService.stop();
  udpDiscoveryService.stop();

  // 兜底超时强制退出：最多等待 1.5 秒，避免任何挂起连接阻碍退出
  const forceExit = setTimeout(() => {
    console.log('Forcefully terminating process.');
    process.exit(0);
  }, 1500);
  forceExit.unref();

  try {
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    if (typeof (server as any).closeIdleConnections === 'function') {
      (server as any).closeIdleConnections();
    }
  } catch (_) {}

  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
