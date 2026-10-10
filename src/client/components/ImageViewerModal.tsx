import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Loader2,
  AlertCircle,
  Lock,
  Link2,
  Check,
  Maximize,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem } from '@shared/types';
import { formatBytes, formatDisplayTime } from '../utils/format';
import { getCharacterInfo, getDisplayNickname } from '../utils/nickname';
import { copyToClipboard } from '../utils/clipboard';

export interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShareItem | null;
  allImageItems?: ShareItem[];
  password?: string;
  onDownload?: (item: ShareItem, password?: string) => void;
  currentAccessUrl?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  item,
  allImageItems = [],
  password,
  onDownload,
  currentAccessUrl,
}) => {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  // 整理有效图片列表
  const imageList = useMemo(() => {
    if (allImageItems.length > 0) {
      if (item && !allImageItems.some((i) => i.id === item.id)) {
        return [item, ...allImageItems];
      }
      return allImageItems;
    }
    return item ? [item] : [];
  }, [allImageItems, item]);

  // 当前显示图片的索引
  const [currentIndex, setCurrentIndex] = useState(0);

  // 当打开或 item 改变时更新索引
  useEffect(() => {
    if (isOpen && item) {
      const idx = imageList.findIndex((i) => i.id === item.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, item, imageList]);

  const currentItem = imageList[currentIndex] || item;

  // 变换状态：缩放、旋转、平移
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // 交互状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 重置视图状态
  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 切换图片时重置
  useEffect(() => {
    resetTransform();
    setImageLoading(true);
    setImageError(false);
  }, [currentIndex, resetTransform]);

  // 获取图片直链 URL
  const getImageUrl = useCallback(
    (targetItem: ShareItem | null, pwd?: string): string => {
      if (!targetItem) return '';
      const origin = (currentAccessUrl || window.location.origin).replace(/\/+$/, '');
      const baseUrl = `${origin}/api/records/${targetItem.id}/download`;
      const p = pwd || targetItem.password;
      return p ? `${baseUrl}?password=${encodeURIComponent(p)}` : baseUrl;
    },
    [currentAccessUrl]
  );

  const currentImageUrl = useMemo(() => {
    return getImageUrl(currentItem, password);
  }, [currentItem, password, getImageUrl]);

  // 缩放操作
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(5, Number((prev + 0.25).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.2, Number((prev - 0.25).toFixed(2))));
  }, []);

  // 顺时针旋转 90 度
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // 切换到下一张/上一张
  const handlePrev = useCallback(() => {
    if (imageList.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imageList.length - 1));
  }, [imageList.length]);

  const handleNext = useCallback(() => {
    if (imageList.length <= 1) return;
    setCurrentIndex((prev) => (prev < imageList.length - 1 ? prev + 1 : 0));
  }, [imageList.length]);

  // 网页原生全屏切换
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // 监听浏览器全屏变化
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // 锁定 body 滚动并在卸载时还原
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免输入法冲突
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          resetTransform();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRotate();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isOpen,
    onClose,
    handlePrev,
    handleNext,
    handleZoomIn,
    handleZoomOut,
    resetTransform,
    handleRotate,
    handleToggleFullscreen,
  ]);

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // 双击切换原尺寸 / 适应屏幕
  const handleDoubleClick = () => {
    if (scale !== 1) {
      resetTransform();
    } else {
      setScale(2);
    }
  };

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 仅左键拖拽
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 下载图片
  const handleDownloadClick = () => {
    if (!currentItem) return;
    if (onDownload) {
      onDownload(currentItem, password || currentItem.password);
    } else {
      const a = document.createElement('a');
      a.href = currentImageUrl;
      a.download = currentItem.fileName || currentItem.title || 'image';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // 复制直链
  const handleCopyLinkClick = async () => {
    if (!currentImageUrl) return;
    const ok = await copyToClipboard(currentImageUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (!isOpen || !currentItem) return null;

  const ext = (
    currentItem.extension ||
    (currentItem.fileName ? currentItem.fileName.split('.').pop() : '') ||
    'IMG'
  ).toUpperCase();

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md text-white select-none animate-fade-in"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 顶部工具栏与文件信息 */}
      <div className="relative z-20 flex items-center justify-between px-3 sm:px-6 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
        {/* 左侧：文件信息与发送者 */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            {ext}
          </span>
          <div className="flex flex-col min-w-0">
            <h2
              className="text-xs sm:text-sm font-semibold text-slate-100 truncate max-w-[200px] sm:max-w-md lg:max-w-xl"
              title={currentItem.title || currentItem.fileName}
            >
              {currentItem.title || currentItem.fileName}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
              <span>{formatBytes(currentItem.fileSize)}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span>{getCharacterInfo(currentItem.senderName || currentItem.nickname).emoji}</span>
                <span className="truncate">
                  {getDisplayNickname(currentItem.senderName || currentItem.nickname, i18n.language)}
                </span>
              </span>
              <span>·</span>
              <span>{formatDisplayTime(currentItem.createdAt)}</span>
              {currentItem.hasPassword && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-400">
                    <Lock className="w-2.5 h-2.5" />
                    <span>{t('preview.encrypted', '加密')}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：缩放/操作按钮群 */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* 多图计数 */}
          {imageList.length > 1 && (
            <div className="px-2 py-1 rounded-lg bg-white/10 text-slate-300 text-[11px] font-mono mr-1">
              {currentIndex + 1} / {imageList.length}
            </div>
          )}

          {/* 缩小 */}
          <button
            onClick={handleZoomOut}
            className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title={`${t('records.zoomOut', '缩小')} (-)`}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* 缩放比例 / 重置 */}
          <button
            onClick={resetTransform}
            className="px-2 py-1 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition min-w-[50px] text-center"
            title={`${t('records.resetZoom', '重置尺寸')} (0)`}
          >
            {Math.round(scale * 100)}%
          </button>

          {/* 放大 */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title={`${t('records.zoomIn', '放大')} (+)`}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* 适应屏幕 / 重置平移 */}
          <button
            onClick={resetTransform}
            className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title={`${t('records.fitScreen', '适应屏幕')}`}
          >
            <Maximize className="w-4 h-4" />
          </button>

          {/* 旋转 */}
          <button
            onClick={handleRotate}
            className="p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title={`${t('records.rotate', '顺时针旋转 90°')} (R)`}
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* 复制直链 */}
          <button
            onClick={handleCopyLinkClick}
            className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title={copiedLink ? t('records.copied', '已复制') : t('records.copyLink', '复制链接')}
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
          </button>

          {/* 新标签页打开原图 */}
          <a
            href={currentImageUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title={t('records.openNewTab', '新窗口打开原图')}
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* 切换网页全屏 */}
          <button
            onClick={handleToggleFullscreen}
            className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title={`${t('records.toggleFullscreen', '全屏模式')} (F)`}
          >
            {isNativeFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* 下载原图 */}
          <button
            onClick={handleDownloadClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md shadow-blue-500/20 active:scale-95 transition ml-1"
            title={t('records.downloadOriginal', '下载原图')}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('records.downloadOriginal', '下载原图')}</span>
          </button>

          {/* 关闭弹窗 */}
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/15 active:scale-95 transition ml-1"
            title={`${t('records.close', '关闭')} (ESC)`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 主展示区 */}
      <div
        className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6 cursor-default"
        onWheel={handleWheel}
        onClick={(e) => {
          // 点击遮罩空白处直接退出预览
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* 加载中状态 */}
        {imageLoading && !imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <span className="text-xs text-slate-400">{t('records.imageLoading', '正在加载高清图片...')}</span>
          </div>
        )}

        {/* 加载失败状态 */}
        {imageError && (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-900/60 rounded-2xl border border-white/10 max-w-sm text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
            <p className="text-sm font-semibold text-slate-200">
              {t('records.imageLoadFailed', '图片加载失败')}
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              {t('records.imageLoadFailedDesc', '该文件可能已被清理、移出或密码错误。')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setImageError(false);
                  setImageLoading(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('records.retry', '重新尝试')}</span>
              </button>
              <button
                onClick={handleDownloadClick}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('records.download', '直接下载')}</span>
              </button>
            </div>
          </div>
        )}

        {/* 核心图片渲染容器 */}
        {!imageError && (
          <div
            className="relative transition-transform duration-75 select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in',
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
          >
            <img
              src={currentImageUrl}
              alt={currentItem.title || currentItem.fileName}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              draggable={false}
              className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg shadow-2xl transition-opacity duration-300 pointer-events-auto"
              style={{
                opacity: imageLoading ? 0.3 : 1,
              }}
            />
          </div>
        )}

        {/* 多图上一张切换按钮 */}
        {imageList.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md shadow-xl transition active:scale-95"
            title={`${t('records.prevImage', '上一张')} (←)`}
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* 多图下一张切换按钮 */}
        {imageList.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md shadow-xl transition active:scale-95"
            title={`${t('records.nextImage', '下一张')} (→)`}
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* 底部悬浮快捷提示胶囊 */}
      <div className="relative z-20 flex justify-center pb-3 px-4 pointer-events-none">
        <div className="px-3.5 py-1.5 rounded-full bg-slate-900/75 border border-white/10 backdrop-blur-md text-[11px] text-slate-400 flex items-center gap-2.5 sm:gap-4 shadow-xl">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">ESC</kbd>
            <span>{t('records.shortcutClose', '退出')}</span>
          </span>
          <span className="text-white/20">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">{t('records.shortcutWheel', '滚轮')}</kbd>
            <span>{t('records.shortcutZoom', '缩放')}</span>
          </span>
          <span className="text-white/20">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">{t('records.shortcutDrag', '拖拽')}</kbd>
            <span>{t('records.shortcutPan', '平移')}</span>
          </span>
          {imageList.length > 1 && (
            <>
              <span className="text-white/20">|</span>
              <span className="hidden sm:flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">← →</kbd>
                <span>{t('records.shortcutSwitch', '切换')}</span>
              </span>
            </>
          )}
          <span className="text-white/20">|</span>
          <span className="hidden sm:flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">R</kbd>
            <span>{t('records.shortcutRotate', '旋转')}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
