import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Check,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem } from '@shared/types';
import { formatBytes, formatDisplayTime } from '../utils/format';
import { copyToClipboard } from '../utils/clipboard';

export interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShareItem | null;
  password?: string;
  onDownload?: (item: ShareItem, password?: string) => void;
  currentAccessUrl?: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  item,
  password,
  onDownload,
  currentAccessUrl,
}) => {
  const { t } = useTranslation();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 监听 ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setIframeLoading(true);
      setHasError(false);
      setCopiedLink(false);
    }
  }, [isOpen, item]);

  // 计算 PDF 预览流地址
  const pdfUrl = useMemo(() => {
    if (!item) return '';
    const origin = (currentAccessUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
      /\/+$/,
      ''
    );
    const parentId = (item as any).batchParentId;
    const p = password || item.password;

    if (parentId) {
      const baseUrl = `${origin}/api/records/${parentId}/download?file=${encodeURIComponent(
        item.fileName || item.title
      )}&inline=true`;
      return p ? `${baseUrl}&password=${encodeURIComponent(p)}` : baseUrl;
    }

    const baseUrl = `${origin}/api/records/${item.id}/download?inline=true`;
    return p ? `${baseUrl}&password=${encodeURIComponent(p)}` : baseUrl;
  }, [item, password, currentAccessUrl]);

  // 复制直链
  const handleCopyLink = useCallback(async () => {
    if (!pdfUrl) return;
    const ok = await copyToClipboard(pdfUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }, [pdfUrl]);

  // 触发下载
  const handleDownloadClick = useCallback(() => {
    if (!item) return;
    if (onDownload) {
      onDownload(item, password || item.password);
    } else {
      const a = document.createElement('a');
      const dlUrl = pdfUrl.replace('inline=true', 'inline=false');
      a.href = dlUrl;
      a.download = item.fileName || item.title || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [item, password, onDownload, pdfUrl]);

  if (!isOpen || !item) return null;

  const displayTitle = item.fileName || item.title || 'PDF Document';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-scale-in transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full max-w-none rounded-none'
            : 'w-full max-w-5xl lg:max-w-6xl h-[90vh]'
        }`}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/80 shrink-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 truncate" title={displayTitle}>
                {displayTitle}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {formatDisplayTime(item.createdAt)} · {formatBytes(item.fileSize)}
              </p>
            </div>
          </div>

          {/* 右上角操作按钮组 */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* 新窗口打开 */}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-rose-600 text-xs font-medium transition active:scale-95 shadow-2xs"
              title={t('preview.openInNewTab', '新标签页打开')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('preview.openInNewTab', '新标签页打开')}</span>
            </a>

            {/* 复制直链 */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-rose-600 text-xs font-medium transition active:scale-95 shadow-2xs"
              title={t('preview.copyLink', '复制直链')}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">{t('preview.copied', '已复制')}</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('preview.copyLink', '复制直链')}</span>
                </>
              )}
            </button>

            {/* 下载文件 */}
            <button
              type="button"
              onClick={handleDownloadClick}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition active:scale-95 shadow-2xs"
              title={t('records.download', '下载')}
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>{t('records.download', '下载')}</span>
            </button>

            {/* 全屏切换 */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition hidden sm:inline-flex"
              title={isFullscreen ? t('preview.exitFullscreen', '退出全屏') : t('preview.fullscreen', '全屏')}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* 关闭 */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition ml-0.5"
              title={t('records.close', '关闭')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 主体内嵌 PDF 预览区 */}
        <div className="flex-1 w-full h-full relative bg-slate-100 overflow-hidden">
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10 gap-2.5">
              <Loader2 className="w-7 h-7 text-rose-600 animate-spin" />
              <span className="text-xs text-slate-500 font-medium">
                {t('preview.loadingPdf', '正在载入 PDF 预览...')}
              </span>
            </div>
          )}

          {hasError ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3 border border-rose-100">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-1">
                {t('preview.pdfLoadError', 'PDF 预览加载失败')}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                {t('preview.pdfFallbackTip', '您的浏览器可能未启用内嵌 PDF 渲染插件，请点击下方在新标签页中打开或直接下载。')}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition"
                >
                  {t('preview.openInNewTab', '新标签页打开')}
                </a>
                <button
                  type="button"
                  onClick={handleDownloadClick}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
                >
                  {t('records.download', '直接下载')}
                </button>
              </div>
            </div>
          ) : (
            <iframe
              src={pdfUrl}
              title={displayTitle}
              className="w-full h-full border-0 bg-slate-50"
              onLoad={() => setIframeLoading(false)}
              onError={() => {
                setIframeLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>

        {/* 底部信息栏 */}
        <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>{t('preview.pdfFooterTip', 'LightDrop PDF 阅读器 · 支持缩放、目录导航与文本检索')}</span>
          <span>{t('preview.escTip', '按 ESC 或点击右上角 X 关闭')}</span>
        </div>
      </div>
    </div>
  );
};
