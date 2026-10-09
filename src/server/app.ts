import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { recordsRouter } from './routes/records.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { statsRouter } from './routes/stats.routes.js';
import { auditRouter } from './routes/audit.routes.js';

export function createApp(): Express {
  const app = express();

  // 跨域支持 (允许局域网多设备无缝连接)
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // API 路由
  app.use('/api/records', recordsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/audit-logs', auditRouter);

  // 生产环境托管静态文件 (dist/client)
  const clientDistPath = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    // PWA 和单页应用路由重定向
    app.get('*', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientDistPath, 'index.html'));
      }
    });
  }

  // 全局错误处理中间件 (特别针对 Multer 异常返回明确 JSON 错误，防止连接假死)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[ServerError]', err);

    if (err instanceof multer.MulterError) {
      let message = `文件上传错误: ${err.message}`;
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = '文件过大，超出系统上传限制';
      } else if (err.code === 'LIMIT_FILE_COUNT') {
        message = '同时上传的文件数量过多';
      }
      res.status(400).json({
        success: false,
        error: message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: err?.message || '服务器处理异常',
    });
  });

  return app;
}
