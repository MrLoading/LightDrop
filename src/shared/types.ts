/**
 * EasyDrop 共享记录类型
 */
export type ShareItemType = 'text' | 'file' | 'folder' | 'image';

/**
 * 共享记录数据模型
 */
export interface ShareItem {
  id: string;
  type: ShareItemType;
  title: string;          // 文本标题或文件名/文件夹名
  content?: string;       // 针对文本类型：完整文本内容
  preview?: string;       // 针对文本类型：前100字符摘要或链接预览
  isUrl?: boolean;        // 是否是 URL 链接
  
  // 针对文件和文件夹
  fileName?: string;      // 原始文件名/文件夹名
  originalPath?: string;  // 内部存储文件路径
  mimeType?: string;      // MIME 类型
  fileSize: number;       // 文件字节数或文本字节数
  fileCount?: number;     // 针对文件夹：包含的文件数量
  extension?: string;     // 文件扩展名 (如 pdf, png, zip, etc.)
  
  createdAt: string;      // ISO 字符串或时间戳
  updatedAt: string;
  permission: 'all_can_copy' | 'all_can_download'; // 访问权限
  downloadCount: number;
  hasPassword?: boolean;  // 是否设置了访问密码 (仅作为标志，不透露任何密码)
  password?: string;     // 明文访问密码 (用于发送方或拥有者复制提取信息)
  passwordHash?: string; // 服务端内部密码哈希 (对外接口脱敏过滤)
  senderName?: string;   // 发送者/上传者昵称
  nickname?: string;     // 别名兼容
}

/**
 * 网络接口与 IP 信息
 */
export interface NetworkIpInfo {
  name: string;        // 网卡接口名称，如 'en0', 'en5'
  ip: string;          // IPv4 地址，如 '192.168.206.146'
  url: string;         // 完整访问地址，如 'http://192.168.206.146:8080'
  isDefault: boolean;  // 是否为系统推荐的默认IP
}

/**
 * 系统统计信息
 */
export interface SystemStats {
  totalRecords: number;
  totalStorageBytes: number;
  todaySentCount: number;
  textCount: number;
  fileCount: number;
  folderCount: number;
  imageCount: number;
  onlineUsers: number;
  serverTime: string;
  uptimeSeconds: number;
  ipList?: NetworkIpInfo[];
  defaultUrl?: string;
}

/**
 * 系统设置模型
 */
export interface SystemSettings {
  storageDir: string;           // 存储目录绝对路径
  port: number;                 // 运行端口
  maxFileSizeMB: number;        // 单文件限制 (MB, 0为无限制)
  autoCleanupDays: number;      // 自动清理周期 (天, 0为永不清理)
  allowAnonymousDelete: boolean;// 是否允许访客删除记录
  siteTitle: string;            // 站点标题
}

/**
 * 服务端响应通用包装
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * WebSocket 实时事件
 */
export type WsEventType = 
  | 'INIT_STATE'
  | 'ITEM_CREATED'
  | 'ITEM_DELETED'
  | 'ITEMS_BATCH_DELETED'
  | 'ITEMS_CLEARED'
  | 'ONLINE_COUNT_CHANGED'
  | 'SETTINGS_UPDATED'
  | 'STATS_UPDATED'
  | 'AUDIT_LOGS_UPDATED';

export interface WsMessage<T = any> {
  type: WsEventType;
  payload: T;
  timestamp: string;
}

/**
 * 操作审计类型
 */
export type AuditActionType =
  | 'create_text'
  | 'upload_file'
  | 'upload_image'
  | 'upload_folder'
  | 'copy_text'
  | 'copy_share_link'
  | 'open_share_page'
  | 'verify_password'
  | 'download_file'
  | 'delete_record'
  | 'batch_delete'
  | 'clear_records';

/**
 * 操作审计记录条目
 */
export interface AuditLogItem {
  id: string;
  ip: string;             // 操作者 IP
  nickname?: string;      // 操作者昵称
  time: string;           // 操作时间
  targetTitle: string;    // 操作的记录
  targetId?: string;      // 记录 ID
  action: AuditActionType;// 什么操作
  actionLabel: string;    // 操作名称 (中文)
  details?: string;       // 备注详情
}

/**
 * 操作审计查询响应
 */
export interface AuditLogResponse {
  isLocalHost: boolean;   // 是否为服务启动所在设备访问
  clientIp: string;       // 当前客户端 IP
  logs: AuditLogItem[];
}
