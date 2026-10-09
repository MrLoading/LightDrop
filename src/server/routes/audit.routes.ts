import { Router, Request, Response } from 'express';
import { auditService } from '../services/audit.service.js';
import { wsService } from '../websocket/ws.server.js';

export const auditRouter: Router = Router();

/**
 * 获取操作审计日志列表 (带本机设备权限标志)
 */
auditRouter.get('/', (req: Request, res: Response) => {
  const isLocalHost = auditService.isLocalDevice(req);
  const clientIp = auditService.getClientIp(req);
  const logs = auditService.getLogs();

  res.json({
    success: true,
    data: {
      isLocalHost,
      clientIp,
      logs,
    },
  });
});

/**
 * 清空操作审计记录 (仅允许服务启动所在的主机设备执行)
 */
auditRouter.post('/clear', (req: Request, res: Response) => {
  const isLocalHost = auditService.isLocalDevice(req);
  if (!isLocalHost) {
    res.status(403).json({
      success: false,
      error: '操作被拒绝：仅允许在服务启动所在的主机设备上清空操作记录',
    });
    return;
  }

  auditService.clearLogs();
  wsService.broadcast('AUDIT_LOGS_UPDATED', {});

  res.json({
    success: true,
    message: '操作审计记录已成功清空',
  });
});
