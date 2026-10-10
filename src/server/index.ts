import http from 'http';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { wsService } from './websocket/ws.server.js';
import { configManager } from './config/config.manager.js';
import { cleanupService } from './services/cleanup.service.js';
import { getLocalIpAddress } from './services/ip.service.js';

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

const settings = configManager.getSettings();
const port = Number(process.env.PORT) || settings.port || 8080;
const host = '0.0.0.0';

server.listen(port, host, () => {
  const localIp = getLocalIpAddress();
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ⚡ LightDrop - 局域网快传服务已就绪 (100% TypeScript)      ║
║                                                              ║
║   ► 本地访问:    http://localhost:${port}                       ║
║   ► 局域网访问:  http://${localIp}:${port}                   ║
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
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
