import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { configManager } from '../config/config.manager.js';
import { fileDatabase } from '../database/file.database.js';
import { storageService } from '../services/storage.service.js';
import { wsService } from '../websocket/ws.server.js';
import { cleanupService } from '../services/cleanup.service.js';
import { auditService } from '../services/audit.service.js';

export const settingsRouter: Router = Router();

/**
 * 获取系统配置
 */
settingsRouter.get('/', (req: Request, res: Response) => {
  const settings = configManager.getSettings();
  const storageDir = settings.storageDir;
  const clientIp = auditService.getClientIp(req);
  const isAdmin = auditService.isAdmin(req);
  const configFilePath = configManager.getConfigFilePath();

  let isWritable = false;
  let diskSizeBytes = 0;

  try {
    fs.accessSync(storageDir, fs.constants.W_OK | fs.constants.R_OK);
    isWritable = true;
    diskSizeBytes = storageService.getDirectorySize(storageDir);
  } catch {
    isWritable = false;
  }

  res.json({
    success: true,
    data: {
      ...settings,
      isAdmin,
      clientIp,
      configFilePath,
      isWritable,
      storageSizeBytes: diskSizeBytes,
    },
  });
});

/**
 * 校验指定目录是否合法可写 (仅限管理员)
 */
settingsRouter.post('/validate-dir', (req: Request, res: Response) => {
  if (!auditService.isAdmin(req)) {
    res.status(403).json({
      success: false,
      error: '权限不足：存储路径校验仅限服务器本机或管理员设备执行',
    });
    return;
  }

  const { dirPath } = req.body;
  if (!dirPath || typeof dirPath !== 'string') {
    res.status(400).json({ success: false, error: '请提供目录路径' });
    return;
  }

  const resolved = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
  try {
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    fs.accessSync(resolved, fs.constants.W_OK | fs.constants.R_OK);
    res.json({ success: true, absolutePath: resolved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: `目录不可写或无权限: ${err?.message}` });
  }
});

/**
 * 保存系统配置 (支持更换存储目录与数据迁移，仅限管理员)
 */
settingsRouter.post('/', (req: Request, res: Response) => {
  if (!auditService.isAdmin(req)) {
    res.status(403).json({
      success: false,
      error: '权限不足：服务器全局配置仅允许在部署服务器主机或受信任的管理员设备上修改',
    });
    return;
  }

  const { storageDir, maxFileSizeMB, autoCleanupDays, siteTitle, migrateData, adminIps } = req.body;
  const currentSettings = configManager.getSettings();
  const oldStorageDir = currentSettings.storageDir;

  let newResolvedStorageDir = oldStorageDir;

  if (storageDir && typeof storageDir === 'string' && storageDir.trim()) {
    const candidate = storageDir.trim();
    newResolvedStorageDir = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);

    if (newResolvedStorageDir !== oldStorageDir) {
      try {
        configManager.ensureStorageDirExists(newResolvedStorageDir);

        if (migrateData) {
          console.log(`[Settings] Migrating data from ${oldStorageDir} to ${newResolvedStorageDir}...`);
          const migrationResult = storageService.migrateStorage(oldStorageDir, newResolvedStorageDir);
          if (!migrationResult.success) {
            res.status(500).json({
              success: false,
              error: `迁移数据失败: ${migrationResult.message}`,
            });
            return;
          }
        }
      } catch (err: any) {
        res.status(400).json({
          success: false,
          error: `创建或写入新存储目录失败: ${err?.message}`,
        });
        return;
      }
    }
  }

  const updatedAdminIps = Array.isArray(adminIps)
    ? adminIps.filter((ip: any) => typeof ip === 'string' && ip.trim())
    : currentSettings.adminIps;

  // 保存新配置 (会自动触发 reload 事件并广播通知)
  const updated = configManager.saveSettings({
    storageDir: newResolvedStorageDir,
    maxFileSizeMB: typeof maxFileSizeMB === 'number' ? maxFileSizeMB : currentSettings.maxFileSizeMB,
    autoCleanupDays: typeof autoCleanupDays === 'number' ? autoCleanupDays : currentSettings.autoCleanupDays,
    siteTitle: typeof siteTitle === 'string' ? siteTitle.trim() : currentSettings.siteTitle,
    adminIps: updatedAdminIps,
  });

  const clientIp = auditService.getClientIp(req);
  const isAdmin = auditService.isAdmin(req);
  const configFilePath = configManager.getConfigFilePath();

  let isWritable = false;
  let diskSizeBytes = 0;
  try {
    fs.accessSync(updated.storageDir, fs.constants.W_OK | fs.constants.R_OK);
    isWritable = true;
    diskSizeBytes = storageService.getDirectorySize(updated.storageDir);
  } catch {
    isWritable = false;
  }

  res.json({
    success: true,
    data: {
      ...updated,
      isAdmin,
      clientIp,
      configFilePath,
      isWritable,
      storageSizeBytes: diskSizeBytes,
    },
    message: '设置已成功保存并立即生效',
  });
});
