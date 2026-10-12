import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { SystemSettings } from '../../shared/types.js';
import { DEFAULT_SETTINGS, STORAGE_SETTINGS_FILENAME } from '../../shared/constants.js';

class ConfigManager extends EventEmitter {
  private currentSettings: SystemSettings = { ...DEFAULT_SETTINGS };
  private configFilePath: string;
  private watcherActive: boolean = false;
  private isSelfSaving: boolean = false;

  constructor() {
    super();
    this.configFilePath = this.resolveConfigFile();
    this.loadInitialConfig();
    this.setupWatcher();
  }

  /**
   * 解析配置文件绝对路径
   * 优先环境变量 LIGHTDROP_CONFIG_PATH，次选工作目录或当前运行目录下的 lightdrop.config.json
   */
  private resolveConfigFile(): string {
    if (process.env.LIGHTDROP_CONFIG_PATH && process.env.LIGHTDROP_CONFIG_PATH.trim()) {
      return path.resolve(process.env.LIGHTDROP_CONFIG_PATH.trim());
    }

    const cwdFile = path.resolve(process.cwd(), 'lightdrop.config.json');
    if (fs.existsSync(cwdFile)) {
      return cwdFile;
    }

    // 若当前在 app 子目录，检查父目录是否存在 lightdrop.config.json
    const parentFile = path.resolve(process.cwd(), '..', 'lightdrop.config.json');
    if (fs.existsSync(parentFile)) {
      return parentFile;
    }

    return cwdFile;
  }

  public getConfigFilePath(): string {
    return this.configFilePath;
  }

  private loadInitialConfig(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
        }
      }
    } catch (e) {
      console.warn('[Config] Failed to load config file, fallback to default:', e);
    }

    // 尝试从具体存储目录下读取更详细的 settings.json
    const storageSettingsFile = path.join(this.getAbsoluteStorageDir(), STORAGE_SETTINGS_FILENAME);
    try {
      if (fs.existsSync(storageSettingsFile)) {
        const raw = fs.readFileSync(storageSettingsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // 系统级部署项 (storageDir, port) 严格以主配置文件 lightdrop.config.json 为准，避免容器/宿主机切换时相互污染
          const { storageDir: _s, port: _p, ...appSettings } = parsed;
          this.currentSettings = { ...this.currentSettings, ...appSettings };
        }
      }
    } catch (e) {
      console.warn('[Config] Failed to load storage settings, using current settings:', e);
    }

    // 确保存储目录存在
    this.ensureStorageDirExists();
  }

  /**
   * 启动配置文件热更新监听 (免重启动态生效)
   */
  private setupWatcher(): void {
    if (this.watcherActive) return;
    this.watcherActive = true;

    try {
      const dir = path.dirname(this.configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.configFilePath)) {
        this.writeConfigFile(this.currentSettings);
      }
    } catch (e) {
      console.warn('[Config] Error preparing config file for watching:', e);
    }

    try {
      const dir = path.dirname(this.configFilePath);
      fs.watch(dir, (_eventType, filename) => {
        if (filename && filename.toString().includes('lightdrop.config.json')) {
          if (!this.isSelfSaving) {
            this.reloadFromFile();
          }
        }
      });
    } catch (e) {}

    try {
      fs.watchFile(this.configFilePath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtimeMs !== prev.mtimeMs) {
          if (this.isSelfSaving) {
            return;
          }
          this.reloadFromFile();
        }
      });
    } catch (err) {
      console.warn('[Config] Failed to setup file watcher for config:', err);
    }
  }

  /**
   * 从配置文件重新热载入配置并广播事件
   */
  public reloadFromFile(): boolean {
    try {
      if (!fs.existsSync(this.configFilePath)) return false;
      const raw = fs.readFileSync(this.configFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      const oldSettings = { ...this.currentSettings };
      this.currentSettings = {
        ...this.currentSettings,
        ...parsed,
      };

      // 确保存储目录存在
      this.ensureStorageDirExists();

      // 同步更新存储目录中的 settings.json
      const storageSettingsFile = path.join(this.getAbsoluteStorageDir(), STORAGE_SETTINGS_FILENAME);
      try {
        fs.writeFileSync(storageSettingsFile, JSON.stringify(this.currentSettings, null, 2), 'utf-8');
      } catch (_) {}

      console.log(`[Config] Configuration hot-reloaded successfully from ${this.configFilePath}`);
      this.emit('reload', this.getSettings(), oldSettings);
      return true;
    } catch (e) {
      console.error('[Config] Error reloading configuration from file:', e);
      return false;
    }
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
    const oldSettings = { ...this.currentSettings };
    this.currentSettings = { ...this.currentSettings, ...newSettings };
    const absoluteDir = this.ensureStorageDirExists();

    this.isSelfSaving = true;
    try {
      // 1. 保存到存储目录中的 settings.json
      const storageSettingsFile = path.join(absoluteDir, STORAGE_SETTINGS_FILENAME);
      fs.writeFileSync(storageSettingsFile, JSON.stringify(this.currentSettings, null, 2), 'utf-8');

      // 2. 保存配置文件 lightdrop.config.json
      this.writeConfigFile(this.currentSettings);
    } finally {
      setTimeout(() => {
        this.isSelfSaving = false;
      }, 1500);
    }

    this.emit('reload', this.getSettings(), oldSettings);
    return this.getSettings();
  }

  private writeConfigFile(settings: SystemSettings): void {
    const toWrite = {
      storageDir: settings.storageDir,
      port: settings.port,
      maxFileSizeMB: settings.maxFileSizeMB,
      autoCleanupDays: settings.autoCleanupDays,
      siteTitle: settings.siteTitle,
      adminIps: settings.adminIps || [],
    };
    const dir = path.dirname(this.configFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configFilePath, JSON.stringify(toWrite, null, 2), 'utf-8');
  }
}

export const configManager = new ConfigManager();
