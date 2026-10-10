export type OperatingSystem = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';

/**
 * 检测当前客户端操作系统
 */
export function getOperatingSystem(): OperatingSystem {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unknown';
  }

  const ua = navigator.userAgent || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

  if (/win/i.test(platform) || /windows/i.test(ua)) {
    return 'windows';
  }
  if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) {
    return 'macos';
  }
  if (/android/i.test(ua)) {
    return 'android';
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    return 'ios';
  }
  if (/linux/i.test(platform) || /linux/i.test(ua)) {
    return 'linux';
  }
  return 'unknown';
}

/**
 * 获取操作系统的友好展示名称
 */
export function getOsDisplayName(os?: OperatingSystem): string {
  const currentOs = os || getOperatingSystem();
  switch (currentOs) {
    case 'windows':
      return 'Windows';
    case 'macos':
      return 'macOS';
    case 'linux':
      return 'Linux';
    case 'android':
      return 'Android';
    case 'ios':
      return 'iOS';
    default:
      return '系统';
  }
}

/**
 * 获取系统对应的下载文件夹名称（用于默认下载目录描述）
 */
export function getOsDownloadsFolderName(os?: OperatingSystem, isEnglish = false): string {
  const currentOs = os || getOperatingSystem();
  if (isEnglish) {
    switch (currentOs) {
      case 'windows':
        return 'Windows Downloads Folder';
      case 'macos':
        return 'Mac Downloads Folder';
      case 'linux':
        return 'Linux Downloads Folder';
      default:
        return 'Downloads Folder';
    }
  }

  switch (currentOs) {
    case 'windows':
      return 'Windows 下载文件夹';
    case 'macos':
      return 'Mac 下载文件夹';
    case 'linux':
      return 'Linux 下载文件夹';
    default:
      return '下载文件夹';
  }
}
