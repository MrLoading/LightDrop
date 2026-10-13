import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { Request } from 'express';
import { AuditLogItem, AuditActionType } from '../../shared/types.js';
import { getAllNetworkIps } from './ip.service.js';
import { configManager } from '../config/config.manager.js';

class AuditService {
  private logs: AuditLogItem[] = [];
  private logFilePath: string = '';
  private maxLogs: number = 1000; // 最多保留 1000 条最近审计日志

  constructor() {
    this.refreshPath();
    this.loadLogs();
  }

  public refreshPath() {
    const settings = configManager.getSettings();
    const storageDir = settings.storageDir;
    this.logFilePath = path.join(storageDir, 'audit_logs.json');
  }

  private loadLogs() {
    this.refreshPath();
    try {
      if (fs.existsSync(this.logFilePath)) {
        const raw = fs.readFileSync(this.logFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.logs = parsed;
        }
      } else {
        this.logs = [];
        this.saveLogs();
      }
    } catch (err) {
      console.warn('Failed to load audit logs, initializing empty array:', err);
      this.logs = [];
    }
  }

  private saveLogs() {
    try {
      this.refreshPath();
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.logFilePath, JSON.stringify(this.logs, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save audit logs:', err);
    }
  }

  /**
   * 提取客户端真实 IP 地址
   */
  public getClientIp(req: Request): string {
    const xForwardedFor = req.headers['x-forwarded-for'];
    let ip = '';
    if (typeof xForwardedFor === 'string') {
      ip = xForwardedFor.split(',')[0].trim();
    } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      ip = xForwardedFor[0].trim();
    } else {
      ip = req.socket?.remoteAddress || req.ip || '';
    }

    // 格式化 IPv6 映射的 IPv4
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    if (cleanIp === '::1' || cleanIp === '127.0.0.1') {
      return '127.0.0.1';
    }
    return cleanIp || '127.0.0.1';
  }

  /**
   * 判断请求是否来自服务启动所在的主机设备
   */
  public isLocalDevice(req: Request): boolean {
    const clientIp = this.getClientIp(req);

    // 1. 本机回环地址判定
    if (
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp === '0:0:0:0:0:0:0:1' ||
      clientIp === 'localhost' ||
      clientIp.startsWith('127.') ||
      clientIp === ''
    ) {
      return true;
    }

    // 2. 当前物理设备所拥有的所有网卡 IP（无论用户通过哪个网卡 IP 本机访问）
    const localNetworkIps = getAllNetworkIps(8080, 'http', false).map((item) => item.ip);
    if (localNetworkIps.includes(clientIp)) {
      return true;
    }

    // 3. 容器化部署判定：若在 Docker 容器内运行，宿主机通过端口映射访问时来源 IP 为网桥网关 (如 172.17.0.1)
    if (
      fs.existsSync('/.dockerenv') &&
      (clientIp === '172.17.0.1' || (clientIp.startsWith('172.') && clientIp.endsWith('.1')))
    ) {
      return true;
    }

    return false;
  }

  /**
   * 判断请求是否拥有管理员权限（本机设备或在配置的 adminIps 列表中）
   */
  public isAdmin(req: Request): boolean {
    const clientIp = this.getClientIp(req);

    // 1. 本机设备（127.0.0.1 / localhost / ::1 / 本机物理网卡）始终拥有绝对最高管理员权限
    if (
      this.isLocalDevice(req) ||
      clientIp === '127.0.0.1' ||
      clientIp.startsWith('127.') ||
      clientIp === '::1' ||
      clientIp === 'localhost'
    ) {
      return true;
    }

    const settings = configManager.getSettings();
    const adminIps = settings.adminIps || [];

    for (const rule of adminIps) {
      const trimmed = rule.trim();
      if (!trimmed) continue;
      // 支持通配符如 192.168.1.* 或精准匹配
      if (trimmed.endsWith('*')) {
        const prefix = trimmed.slice(0, -1);
        if (clientIp.startsWith(prefix)) {
          return true;
        }
      } else if (clientIp === trimmed) {
        return true;
      }
    }

    return false;
  }

  /**
   * 提取客户端操作者昵称 (优先请求头，次选 body 或 query，默认回退为海绵宝宝)
   */
  public getClientNickname(req: Request): string {
    const headerVal = req.headers['x-user-nickname'];
    if (typeof headerVal === 'string' && headerVal.trim()) {
      try {
        return decodeURIComponent(headerVal.trim());
      } catch {
        return headerVal.trim();
      }
    }
    if (req.body && typeof req.body.nickname === 'string' && req.body.nickname.trim()) {
      return req.body.nickname.trim();
    }
    if (req.query && typeof req.query.nickname === 'string' && req.query.nickname.trim()) {
      try {
        return decodeURIComponent(req.query.nickname.trim());
      } catch {
        return req.query.nickname.trim();
      }
    }
    return '海绵宝宝';
  }

  /**
   * 记录审计日志
   */
  public log(
    req: Request,
    action: AuditActionType,
    actionLabel: string,
    targetTitle: string,
    targetId?: string,
    details?: string,
    customNickname?: string
  ) {
    const ip = this.getClientIp(req);
    const nickname = customNickname || this.getClientNickname(req);
    const item: AuditLogItem = {
      id: nanoid(10),
      ip,
      nickname,
      time: new Date().toISOString(),
      targetTitle: targetTitle || '无标题',
      targetId,
      action,
      actionLabel,
      details,
    };

    // 插入到头部，按时间倒序
    this.logs.unshift(item);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    this.saveLogs();
    return item;
  }

  /**
   * 获取所有审计日志
   */
  public getLogs(limit: number = 200): AuditLogItem[] {
    return this.logs.slice(0, limit);
  }

  /**
   * 清空所有审计日志
   */
  public clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }
}

export const auditService = new AuditService();
