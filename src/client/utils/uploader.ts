import i18n from '../i18n';
import { getUserNickname } from './nickname';

export interface UploadProgressInfo {
  percent: number;
  loaded: number;
  total: number;
  speedText?: string;
}

export interface UploadTaskHandle {
  promise: Promise<any>;
  abort: () => void;
}

/**
 * 基于 XMLHttpRequest 的可取消、带实时进度的上传器
 */
export function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress?: (info: UploadProgressInfo) => void
): UploadTaskHandle {
  const xhr = new XMLHttpRequest();
  let startTime = Date.now();
  let lastLoaded = 0;

  const promise = new Promise<any>((resolve, reject) => {
    xhr.open('POST', url, true);
    try {
      const nickname = getUserNickname();
      if (nickname) {
        xhr.setRequestHeader('x-user-nickname', encodeURIComponent(nickname));
      }
    } catch (_) {}

    // 监听上传进度
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        const now = Date.now();
        const durationSec = (now - startTime) / 1000;
        let speedText = '';

        if (durationSec > 0.5) {
          const bytesPerSec = (event.loaded - lastLoaded) / durationSec;
          if (bytesPerSec > 1024 * 1024) {
            speedText = `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
          } else if (bytesPerSec > 1024) {
            speedText = `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
          }
        }

        onProgress({
          percent,
          loaded: event.loaded,
          total: event.total,
          speedText,
        });
      }
    };

    xhr.onload = () => {
      const status = xhr.status;
      let responseJson: any = null;

      try {
        responseJson = JSON.parse(xhr.responseText);
      } catch {
        // 非 JSON 格式
      }

      if (status >= 200 && status < 300) {
        if (responseJson && responseJson.success === false) {
          reject(new Error(responseJson.error || i18n.t('send.errUploadFailed')));
        } else {
          resolve(responseJson || { success: true });
        }
      } else {
        const errMsg =
          responseJson?.error ||
          (status === 413
            ? i18n.t('send.errFileTooLarge')
            : status === 403
            ? i18n.t('send.errForbiddenOrPwd')
            : `${i18n.t('send.errUploadFailed')} (HTTP ${status})`);
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        reject(new Error(i18n.t('send.errNetworkOffline')));
      } else {
        reject(new Error(i18n.t('send.errTransferInterrupted')));
      }
    };

    xhr.onabort = () => {
      const abortErr = new Error(i18n.t('send.toastCancelUpload'));
      (abortErr as any).name = 'AbortError';
      reject(abortErr);
    };

    xhr.send(formData);
  });

  return {
    promise,
    abort: () => {
      try {
        xhr.abort();
      } catch (_) {}
    },
  };
}
