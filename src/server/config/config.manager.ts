import fs from 'fs';
import path from 'path';
import { SystemSettings } from '../../shared/types.js';
import { DEFAULT_SETTINGS, STORAGE_SETTINGS_FILENAME } from '../../shared/constants.js';

class ConfigManager {
  private currentSettings: SystemSettings = { ...DEFAULT_SETTINGS };
  private bootstrapConfigPath: string;

  constructor() {
    // 根目录下的引导配置文件记录当前存储目录指向
    this.bootstrapConfigPath = path.resolve(process.cwd(), 'easydrop.config.json');
    this.loadInitialConfig();
  }

  private loadInitialConfig(): void {
    try {
      if (fs.existsSync(this.bootstrapConfigPath)) {
        const raw = fs.readFileSync(this.bootstrapConfigPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('[Config] Failed to load bootstrap config, fallback to default:', e);
    }

    // 尝试从具体存储目录下读取更详细的 settings.json
    const storageSettingsFile = path.join(this.getAbsoluteStorageDir(), STORAGE_SETTINGS_FILENAME);
    try {
      if (fs.existsSync(storageSettingsFile)) {
        const raw = fs.readFileSync(storageSettingsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.currentSettings = { ...this.currentSettings, ...parsed };
      }
    } catch (e) {
      console.warn('[Config] Failed to load storage settings, using current settings:', e);
    }

    // 确保存储目录存在
    this.ensureStorageDirExists();
  }

  public getSettings(): SystemSettings {
    return {
      ...this.currentSettings,
      storageDir: this.getAbsoluteStorageDir(),
    };
  }

  public getAbsoluteStorageDir(customDir?: string): string {
    const dir = customDir || this.currentSettings.storageDir;
    if (path.isAbsolute(dir)) {
      return dir;
    }
    return path.resolve(process.cwd(), dir);
  }

  public ensureStorageDirExists(dirPath?: string): string {
    const target = dirPath || this.getAbsoluteStorageDir();
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    const filesSubDir = path.join(target, 'files');
    if (!fs.existsSync(filesSubDir)) {
      fs.mkdirSync(filesSubDir, { recursive: true });
    }
    return target;
  }

  public saveSettings(newSettings: Partial<SystemSettings>): SystemSettings {
    this.currentSettings = { ...this.currentSettings, ...newSettings };
    const absoluteDir = this.ensureStorageDirExists();

    // 1. 保存到存储目录中的 settings.json
    const storageSettingsFile = path.join(absoluteDir, STORAGE_SETTINGS_FILENAME);
    fs.writeFileSync(storageSettingsFile, JSON.stringify(this.currentSettings, null, 2), 'utf-8');

    // 2. 保存引导配置文件 (记录当前存储目录路径，下次启动仍能正确定位)
    fs.writeFileSync(
      this.bootstrapConfigPath,
      JSON.stringify(
        {
          storageDir: this.currentSettings.storageDir,
          port: this.currentSettings.port,
        },
        null,
        2
      ),
      'utf-8'
    );

    return this.getSettings();
  }
}

export const configManager = new ConfigManager();
