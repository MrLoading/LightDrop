import i18n from '../i18n';

/**
 * 格式化字节大小为可读字符串 (如 1.2 KB, 246 MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i === 0) return `${bytes} B`;

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 格式化相对时间为 "今天 14:22"、"昨天 18:30" 或 "YYYY-MM-DD HH:mm"
 */
export function formatDisplayTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - targetDay.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (diffDays === 0) {
    return `${i18n.t('format.today')} ${timeStr}`;
  } else if (diffDays === 1) {
    return `${i18n.t('format.yesterday')} ${timeStr}`;
  } else if (diffDays === 2) {
    return `${i18n.t('format.dayBeforeYesterday')} ${timeStr}`;
  } else {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day} ${timeStr}`;
  }
}

/**
 * 获取友好的文件类型展示标签
 */
export function getFileTypeLabel(fileName: string = '', extension: string = '', mimeType: string = ''): string {
  let ext = (extension || (fileName.includes('.') ? fileName.split('.').pop() : '') || '').toLowerCase();

  // If no extension, infer from mimeType
  if (!ext && mimeType) {
    const mt = mimeType.toLowerCase();
    if (mt.startsWith('image/')) return i18n.t('format.imageFile');
    if (mt.startsWith('video/')) return i18n.t('format.videoFile');
    if (mt.startsWith('audio/')) return i18n.t('format.audioFile');
    if (mt === 'application/pdf') return i18n.t('format.pdfFile');
    if (mt.includes('word') || mt.includes('wordprocessingml')) return i18n.t('format.wordDoc');
    if (mt.includes('sheet') || mt.includes('spreadsheetml')) return i18n.t('format.sheetDoc');
    if (mt.includes('presentation') || mt.includes('presentationml')) return i18n.t('format.slideDoc');
    if (mt.includes('zip') || mt.includes('tar') || mt.includes('compressed')) return i18n.t('format.archiveFile');
    if (mt.includes('markdown')) return i18n.t('format.markdownDoc');
    if (mt.startsWith('text/')) return i18n.t('format.textFile');
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return i18n.t('format.imageFile');
  }
  if (['pdf'].includes(ext)) {
    return i18n.t('format.pdfFile');
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return i18n.t('format.archiveFile');
  }
  if (['doc', 'docx'].includes(ext)) {
    return i18n.t('format.wordDoc');
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return i18n.t('format.sheetDoc');
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return i18n.t('format.slideDoc');
  }
  if (['md', 'markdown'].includes(ext)) {
    return i18n.t('format.markdownDoc');
  }
  if (['txt', 'log'].includes(ext)) {
    return i18n.t('format.textFile');
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'].includes(ext)) {
    return i18n.t('format.videoFile');
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
    return i18n.t('format.audioFile');
  }
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'go', 'rs', 'html', 'css', 'json', 'yaml', 'yml', 'xml', 'sql', 'sh', 'bash', 'vue'].includes(ext)) {
    return i18n.t('format.sourceCode');
  }
  return ext && ext.length <= 6 ? i18n.t('format.customFile', { ext: ext.toUpperCase() }) : i18n.t('format.unknownFile');
}

/**
 * 判断是否为图片类型项目 (基于类型、扩展名或 MIME)
 */
export function isImageItem(
  item?: { type?: string; fileName?: string; title?: string; extension?: string; mimeType?: string } | null
): boolean {
  if (!item) return false;
  if (item.type === 'image') return true;
  const name = item.fileName || item.title || '';
  const ext = (item.extension || (name.includes('.') ? name.split('.').pop() : '') || '').toLowerCase();
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff', 'tif', 'heic', 'heif'];
  if (imageExts.includes(ext)) {
    return true;
  }
  if (item.mimeType && item.mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }
  return false;
}
