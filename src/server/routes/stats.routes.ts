import { Router, Request, Response } from 'express';
import { fileDatabase } from '../database/file.database.js';
import { wsService } from '../websocket/ws.server.js';
import { getLocalIpAddress, getAllNetworkIps } from '../services/ip.service.js';
import { configManager } from '../config/config.manager.js';

export const statsRouter: Router = Router();

const serverStartTime = Date.now();

statsRouter.get('/', (req: Request, res: Response) => {
  const dbStats = fileDatabase.getStats();
  const onlineUsers = wsService.getOnlineCount();
  const settings = configManager.getSettings();
  const localIp = getLocalIpAddress();
  const port = Number(process.env.PORT) || settings.port || 8080;
  const protocol = req.protocol || 'http';
  const ipList = getAllNetworkIps(port, protocol);

  const defaultUrl = ipList.find((item) => item.isDefault)?.url || `http://${localIp}:${port}`;

  res.json({
    success: true,
    data: {
      ...dbStats,
      onlineUsers: Math.max(1, onlineUsers),
      accessUrl: defaultUrl,
      defaultUrl,
      ipList,
      localIp,
      port,
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
      status: 'healthy',
    },
  });
});
