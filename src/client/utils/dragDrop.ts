export interface ProcessedFolder {
  name: string;
  files: File[];
  paths: string[];
}

export interface ProcessedDropData {
  individualFiles: File[];
  folders: ProcessedFolder[];
}

/**
 * 递归读取 FileSystemDirectoryReader (处理单次最多100个条目的规范限制)
 */
async function readAllEntries(dirReader: any): Promise<any[]> {
  const entries: any[] = [];
  let readSuccess = true;

  while (readSuccess) {
    const batch = await new Promise<any[]>((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
    if (batch && batch.length > 0) {
      entries.push(...batch);
    } else {
      readSuccess = false;
    }
  }

  return entries;
}

/**
 * 递归扫描 DirectoryEntry 下的所有文件及其相对路径
 */
async function scanDirectory(
  dirEntry: any,
  currentPath: string,
  resultFiles: File[],
  resultPaths: string[]
): Promise<void> {
  const dirReader = dirEntry.createReader();
  const entries = await readAllEntries(dirReader);

  for (const entry of entries) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file(resolve, reject);
      });
      resultFiles.push(file);
      resultPaths.push(entryPath);
    } else if (entry.isDirectory) {
      await scanDirectory(entry, entryPath, resultFiles, resultPaths);
    }
  }
}

/**
 * 深度解析从拖拽 DataTransfer 中传入的所有文件与文件夹
 */
export async function extractDroppedItems(dataTransfer: DataTransfer): Promise<ProcessedDropData> {
  const individualFiles: File[] = [];
  const folders: ProcessedFolder[] = [];

  const items = dataTransfer.items;

  // 1. 优先使用现代 FileSystem Entry API 识别文件夹与层级
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;

      const entry = item.webkitGetAsEntry();
      if (!entry) continue;

      if (entry.isFile) {
        promises.push(
          new Promise<void>((resolve, reject) => {
            (entry as any).file((file: File) => {
              individualFiles.push(file);
              resolve();
            }, reject);
          })
        );
      } else if (entry.isDirectory) {
        promises.push(
          (async () => {
            const folderFiles: File[] = [];
            const folderPaths: string[] = [];
            await scanDirectory(entry, entry.name, folderFiles, folderPaths);
            if (folderFiles.length > 0) {
              folders.push({
                name: entry.name,
                files: folderFiles,
                paths: folderPaths,
              });
            }
          })()
        );
      }
    }

    await Promise.all(promises);
    return { individualFiles, folders };
  }

  // 2. 降级方案：普通 files 列表
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      individualFiles.push(dataTransfer.files[i]);
    }
  }

  return { individualFiles, folders };
}
