import fs from 'fs';
import path from 'path';
import { ShareItem } from '../../shared/types.js';
import { STORAGE_RECORDS_FILENAME } from '../../shared/constants.js';
import { configManager } from '../config/config.manager.js';

export class FileDatabase {
  private records: Map<string, ShareItem> = new Map();
  private isLoaded = false;

  constructor() {
    this.reload();
  }

  /**
   * 从当前存储目录中重新加载数据
   */
  public reload(): void {
    this.records.clear();
    const storageDir = configManager.getSettings().storageDir;
    const recordsPath = path.join(storageDir, STORAGE_RECORDS_FILENAME);

    if (fs.existsSync(recordsPath)) {
      try {
        const content = fs.readFileSync(recordsPath, 'utf-8');
        const list: ShareItem[] = JSON.parse(content);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item.type === 'file' && item.fileName) {
              const ext = path.extname(item.fileName).slice(1).toLowerCase();
              const isImg = [
                'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff', 'tif', 'heic', 'heif'
              ].includes(ext) || Boolean(item.mimeType && item.mimeType.startsWith('image/'));
              if (isImg) {
                item.type = 'image';
              }
            }
            if (!item.senderName && !item.nickname) {
              item.senderName = '海绵宝宝';
              item.nickname = '海绵宝宝';
            } else if (!item.senderName) {
              item.senderName = item.nickname;
            } else if (!item.nickname) {
              item.nickname = item.senderName;
            }
            this.records.set(item.id, item);
          }
        }
      } catch (err) {
        console.error('[Database] Error reading records.json, initializing empty:', err);
      }
    } else {
      // 写入初始空数组
      this.persist();
    }
    this.isLoaded = true;
  }

  /**
   * 将内存记录原子化写入磁盘 (先写临时文件再 rename)
   */
  private persist(): void {
    const storageDir = configManager.getSettings().storageDir;
    configManager.ensureStorageDirExists(storageDir);

    const recordsPath = path.join(storageDir, STORAGE_RECORDS_FILENAME);
    const tempPath = `${recordsPath}.${Date.now()}.tmp`;

    const data = Array.from(this.records.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, recordsPath);
    } catch (err) {
      console.error('[Database] Failed to persist records:', err);
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (_) {}
      }
    }
  }

  public getAll(): ShareItem[] {
    return Array.from(this.records.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getById(id: string): ShareItem | undefined {
    return this.records.get(id);
  }

  public insert(item: ShareItem): ShareItem {
    this.records.set(item.id, item);
    this.persist();
    return item;
  }

  public update(id: string, updates: Partial<ShareItem>): ShareItem | undefined {
    const existing = this.records.get(id);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    this.persist();
    return updated;
  }

  public delete(id: string): boolean {
    if (this.records.has(id)) {
      this.records.delete(id);
      this.persist();
      return true;
    }
    return false;
  }

  public deleteMany(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.records.has(id)) {
        this.records.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.persist();
    }
    return count;
  }

  public clearAll(): number {
    const count = this.records.size;
    this.records.clear();
    this.persist();
    return count;
  }

  public getStats() {
    const list = this.getAll();
    let totalStorageBytes = 0;
    let textCount = 0;
    let fileCount = 0;
    let folderCount = 0;
    let imageCount = 0;
    let batchCount = 0;

    const todayStr = new Date().toISOString().slice(0, 10);
    let todaySentCount = 0;

    for (const item of list) {
      totalStorageBytes += item.fileSize || 0;
      if (item.type === 'text') textCount++;
      else if (item.type === 'image') imageCount++;
      else if (item.type === 'file') fileCount++;
      else if (item.type === 'folder') folderCount++;
      else if (item.type === 'batch') {
        batchCount++;
        if (item.isImageBatch) imageCount++;
        else fileCount++;
      }

      if (item.createdAt.startsWith(todayStr)) {
        todaySentCount++;
      }
    }

    return {
      totalRecords: list.length,
      totalStorageBytes,
      todaySentCount,
      textCount,
      fileCount,
      folderCount,
      imageCount,
      batchCount,
    };
  }
}

export const fileDatabase = new FileDatabase();
