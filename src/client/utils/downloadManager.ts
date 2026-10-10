import { ShareItem } from '../../shared/types.js';
import { getUserNickname } from './nickname.js';

export type DownloadDestinationType = 'browser_default' | 'custom_directory';

export interface SavedDirectoryInfo {
  type: DownloadDestinationType;
  handle: FileSystemDirectoryHandle | null;
  dirName: string | null;
}

const DB_NAME = 'lightdrop_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'directory_handles';
const KEY_DIR_HANDLE = 'download_directory_handle';
const LOCAL_STORAGE_KEY_DEST_TYPE = 'lightdrop_download_dest_type';
const LOCAL_STORAGE_KEY_DIR_NAME = 'lightdrop_download_dir_name';

/**
 * 检查当前浏览器环境是否支持 File System Access API (showDirectoryPicker)
 */
export const isDirectoryPickerSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

/**
 * 打开用于缓存 DirectoryHandle 的轻量 IndexedDB 数据库
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 读取浏览器缓存的上次下载设置信息
 */
export async function getSavedDownloadDirectory(): Promise<SavedDirectoryInfo> {
  let fallbackName: string | null = null;
  let savedDestType: DownloadDestinationType = 'browser_default';

  try {
    fallbackName = localStorage.getItem(LOCAL_STORAGE_KEY_DIR_NAME);
    const storedType = localStorage.getItem(LOCAL_STORAGE_KEY_DEST_TYPE);
    if (storedType === 'custom_directory') {
      savedDestType = 'custom_directory';
    } else if (storedType === 'browser_default') {
      savedDestType = 'browser_default';
    } else if (fallbackName) {
      savedDestType = 'custom_directory';
    } else {
      savedDestType = 'browser_default';
    }
  } catch (_) {}

  // 若不支持目录选择 API，固定使用浏览器默认下载
  if (!isDirectoryPickerSupported()) {
    return { type: 'browser_default', handle: null, dirName: fallbackName };
  }

  // 若用户设置了默认下载模式
  if (savedDestType === 'browser_default') {
    return { type: 'browser_default', handle: null, dirName: null };
  }

  // 自定义目录模式：从 IndexedDB 读取 handle
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_DIR_HANDLE);
      req.onsuccess = () => {
        const handle = (req.result as FileSystemDirectoryHandle) || null;
        const dirName = handle ? handle.name : fallbackName;
        if (handle) {
          resolve({ type: 'custom_directory', handle, dirName });
        } else {
          resolve({ type: 'browser_default', handle: null, dirName: null });
        }
      };
      req.onerror = () => {
        resolve({ type: 'browser_default', handle: null, dirName: fallbackName });
      };
    });
  } catch (e) {
    return { type: 'browser_default', handle: null, dirName: fallbackName };
  }
}

/**
 * 设置为浏览器原生默认下载模式 (即保存到 Mac 系统的“下载”目录)
 */
export async function setBrowserDefaultDownload(): Promise<SavedDirectoryInfo> {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_DEST_TYPE, 'browser_default');
  } catch (_) {}
  return { type: 'browser_default', handle: null, dirName: null };
}

/**
 * 将用户选定的下载目录句柄及名称持久化缓存至浏览器
 */
export async function saveDownloadDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_DEST_TYPE, 'custom_directory');
    localStorage.setItem(LOCAL_STORAGE_KEY_DIR_NAME, handle.name);
  } catch (_) {}

  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, KEY_DIR_HANDLE);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[DownloadManager] Failed to persist directory handle:', e);
  }
}

/**
 * 清除已缓存的下载目录信息
 */
export async function clearSavedDownloadDirectory(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_DEST_TYPE);
    localStorage.removeItem(LOCAL_STORAGE_KEY_DIR_NAME);
  } catch (_) {}

  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY_DIR_HANDLE);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[DownloadManager] Failed to clear directory handle:', e);
  }
}

/**
 * 唤起系统目录选择框选择新目录，并自动更新浏览器缓存
 */
export async function pickDownloadDirectory(): Promise<SavedDirectoryInfo> {
  if (!isDirectoryPickerSupported()) {
    throw new Error('当前浏览器环境不支持选择本地目录 API');
  }
  const handle = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
  });
  await saveDownloadDirectory(handle);
  return { type: 'custom_directory', handle, dirName: handle.name };
}

/**
 * 检查/重新激活目录的读写权限
 */
export async function verifyDirectoryPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const query = await (handle as any).queryPermission({ mode: 'readwrite' });
    if (query === 'granted') return true;
    const request = await (handle as any).requestPermission({ mode: 'readwrite' });
    return request === 'granted';
  } catch (e) {
    console.warn('[DownloadManager] Permission check failed:', e);
    return false;
  }
}

/**
 * 获取格式化后的文件名
 */
export function getRecordDownloadFileName(item: ShareItem): string {
  if (item.type === 'folder') {
    return item.title?.toLowerCase().endsWith('.zip') ? item.title : `${item.title || 'Folder'}.zip`;
  }
  if (item.type === 'text') {
    const title = (item.title || 'Note').replace(/[\\/:*?"<>|]/g, '_').trim();
    return title.toLowerCase().endsWith('.md') ? title : `${title}.md`;
  }
  return item.fileName || item.title || 'file';
}

/**
 * 构造下载请求 URL
 */
export function buildDownloadUrl(item: ShareItem, password?: string): string {
  const visitorNickname = getUserNickname();
  const params = new URLSearchParams();
  if (password) params.set('password', password);
  if (visitorNickname) params.set('nickname', visitorNickname);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return `/api/records/${item.id}/download${queryString}`;
}

/**
 * 将远端数据流直接保存到本地文件目录中
 */
export async function saveFileToDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  downloadUrl: string,
  onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<void> {
  const hasPermission = await verifyDirectoryPermission(dirHandle);
  if (!hasPermission) {
    throw new Error('未获得目标保存目录的写入权限');
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    let errorMsg = '下载文件请求失败';
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  const contentLength = Number(response.headers.get('Content-Length')) || 0;
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await (fileHandle as any).createWritable();

  if (response.body) {
    const reader = response.body.getReader();
    let loaded = 0;

    const progressStream = new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            break;
          }
          loaded += value.byteLength;
          if (contentLength > 0 && onProgress) {
            const percent = Math.min(100, Math.round((loaded / contentLength) * 100));
            onProgress(percent, loaded, contentLength);
          }
          controller.enqueue(value);
        }
      },
    });

    await progressStream.pipeTo(writable);
  } else {
    const blob = await response.blob();
    await writable.write(blob);
    await writable.close();
  }
}

/**
 * 传统浏览器下载触发器 (用于不支持 showDirectoryPicker 的浏览器降级)
 */
export function triggerBrowserFallbackDownload(downloadUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
