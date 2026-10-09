/**
 * 可靠的跨平台复制到剪贴板函数
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 现代 Clipboard API (仅在 HTTPS 或 localhost 作用)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, fallback to execCommand:', err);
    }
  }

  // 降级方案：创建临时 textarea 元素并调用 document.execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback execCommand copy failed:', err);
    return false;
  }
}
