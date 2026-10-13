import { Router, Request, Response } from 'express';
import { fileDatabase } from '../database/file.database.js';
import { wsService } from '../websocket/ws.server.js';
import {
  getLocalIpAddress,
  getAllNetworkIps,
  getBonjourHost,
  getBonjourUrl,
  getLocalHostName,
} from '../services/ip.service.js';
import { configManager } from '../config/config.manager.js';
import { DEFAULT_UDP_PORT } from '../../shared/constants.js';

export const statsRouter: Router = Router();

const serverStartTime = Date.now();

statsRouter.get('/', (req: Request, res: Response) => {
  const dbStats = fileDatabase.getStats();
  const onlineUsers = wsService.getOnlineCount();
  const settings = configManager.getSettings();
  const localIp = getLocalIpAddress();
  const port = Number(process.env.PORT) || settings.port || 8080;
  const protocol = req.protocol || 'http';
  const ipList = getAllNetworkIps(port, protocol, true);
  const bonjourHost = getBonjourHost();
  const bonjourUrl = getBonjourUrl(port, protocol);
  const localHostName = getLocalHostName();

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
      bonjourHost,
      bonjourUrl,
      localHostName,
      udpDiscoveryPort: settings.enableUdpDiscovery !== false ? DEFAULT_UDP_PORT : undefined,
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
      status: 'healthy',
    },
  });
});
