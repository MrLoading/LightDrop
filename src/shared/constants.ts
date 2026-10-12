import { SystemSettings } from './types.js';

export const DEFAULT_PORT = 8080;

export const DEFAULT_SETTINGS: SystemSettings = {
  storageDir: './data',
  port: DEFAULT_PORT,
  maxFileSizeMB: 1024, // 默认 1GB
  autoCleanupDays: 0,  // 默认永不清理
  allowAnonymousDelete: true,
  siteTitle: 'LightDrop',
  adminIps: [],
};

export const STORAGE_FILES_DIRNAME = 'files';
export const STORAGE_RECORDS_FILENAME = 'records.json';
export const STORAGE_SETTINGS_FILENAME = 'settings.json';
