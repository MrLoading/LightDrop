const NOTIFICATION_PREF_KEY = 'lightdrop_desktop_notification_enabled';

/**
 * 检查当前浏览器环境是否支持系统原生桌面通知
 */
export function isDesktopNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && typeof window.Notification !== 'undefined';
}

/**
 * 获取当前系统的通知授权状态
 */
export function getDesktopNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isDesktopNotificationSupported()) return 'unsupported';
  return window.Notification.permission;
}

/**
 * 检查用户是否在应用设置中开启了系统桌面通知
 * 默认策略：若已授权，则默认开启；未配置过时依系统授权状态为准
 */
export function isDesktopNotificationEnabled(): boolean {
  if (!isDesktopNotificationSupported()) return false;
  if (window.Notification.permission !== 'granted') return false;
  try {
    const saved = localStorage.getItem(NOTIFICATION_PREF_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch (_) {}
  // 默认如果已授权则开启
  return true;
}

/**
 * 设置用户是否在应用中启用系统通知
 */
export function setDesktopNotificationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(NOTIFICATION_PREF_KEY, enabled ? 'true' : 'false');
  } catch (_) {}
}

/**
 * 请求浏览器系统通知权限
 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (!isDesktopNotificationSupported()) return false;
  try {
    const perm = await window.Notification.requestPermission();
    if (perm === 'granted') {
      setDesktopNotificationEnabled(true);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[DesktopNotification] Failed to request permission:', err);
    return false;
  }
}

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
  force?: boolean; // 用于测试通知跳过 enabled 检查
}

/**
 * 发送系统原生桌面横幅通知 (macOS 通知中心 / Windows 操作中心)
 */
export function sendDesktopNotification(options: DesktopNotificationOptions): boolean {
  if (!isDesktopNotificationSupported()) return false;
  if (window.Notification.permission !== 'granted') return false;
  if (!options.force && !isDesktopNotificationEnabled()) return false;

  try {
    const icon = options.icon || '/icons/icon-192.png';
    const notification = new window.Notification(options.title, {
      body: options.body,
      icon,
      tag: options.tag,
    });

    notification.onclick = (event) => {
      event.preventDefault();
      try {
        window.focus();
      } catch (_) {}
      if (options.onClick) {
        options.onClick();
      }
      notification.close();
    };

    return true;
  } catch (err) {
    console.warn('[DesktopNotification] Failed to send notification:', err);
    return false;
  }
}
