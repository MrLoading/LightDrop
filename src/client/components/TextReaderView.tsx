import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  FileText,
  Code2,
  Eye,
  FileDown,
  ArrowUp,
  ArrowLeft,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import { ShareItem } from '@shared/types';
import { copyToClipboard } from '../utils/clipboard';
import { formatDisplayTime } from '../utils/format';

interface TextReaderViewProps {
  item: ShareItem;
  customContent?: string;
  onClose?: () => void;
  isStandalone?: boolean;
}

export const TextReaderView: React.FC<TextReaderViewProps> = ({
  item,
  customContent,
  onClose,
  isStandalone = false,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');

  // 下载为 .md 命名确认弹窗
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState('');

  // 长文本滚动状态与阅读进度
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 原始文本内容
  const rawContent = customContent || item.content || item.preview || '';

  // 监听 ESC 键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRenameDialog) {
          setShowRenameDialog(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRenameDialog, onClose]);

  // 配置与渲染 Markdown HTML (支持 GFM、自动断行与表格)
  const markdownHtml = useMemo(() => {
    try {
      marked.setOptions({
        gfm: true,
        breaks: true,
      });
      return marked.parse(rawContent) as string;
    } catch (err) {
      console.error('Markdown parse error:', err);
      return `<pre class="whitespace-pre-wrap font-mono text-xs">${rawContent}</pre>`;
    }
  }, [rawContent]);

  // 一键复制
  const handleCopy = async () => {
    const ok = await copyToClipboard(rawContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 点击“下载为 .md”
  const handleStartDownload = () => {
    const sanitizedTitle = (item.title || t('markdownModal.defaultNote', '笔记'))
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\.+$/, '')
      .trim();
    const defaultName = sanitizedTitle.toLowerCase().endsWith('.md')
      ? sanitizedTitle
      : `${sanitizedTitle}.md`;
    setDownloadFilename(defaultName);
    setShowRenameDialog(true);
  };

  // 确认命名并下载
  const handleConfirmDownload = () => {
    let finalName = downloadFilename.trim();
    if (!finalName) {
      finalName = t('markdownModal.defaultDoc', '文档.md');
    }
    if (!finalName.toLowerCase().endsWith('.md')) {
      finalName += '.md';
    }

    try {
      const blob = new Blob([rawContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowRenameDialog(false);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // 监听长文本滚动，计算阅读进度与“回到顶部”按钮显示
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const totalScroll = scrollHeight - clientHeight;
    if (totalScroll > 0) {
      const progress = Math.min(100, Math.max(0, (scrollTop / totalScroll) * 100));
      setScrollProgress(progress);
    } else {
      setScrollProgress(0);
    }
    setShowBackToTop(scrollTop > 240);
  };

  // 平滑滚动回顶部
  const scrollToTop = () => {
    scrollRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const handleCloseClick = () => {
    if (onClose) {
      onClose();
    } else if (isStandalone) {
      window.location.href = '/';
    }
  };

  return (
    <div className="relative flex flex-col w-full h-full bg-white select-text overflow-hidden">
      {/* 顶部阅读进度条 (长文本滚动时的视觉指示器) */}
      <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-transparent z-30 pointer-events-none">
        <div
          className="h-full bg-blue-600 transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* 顶部标题栏与功能操作按钮组 (与设计图完全一致) */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-slate-50/70 shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0 pr-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate" title={item.title}>
              {item.title}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {formatDisplayTime(item.createdAt)} · {t('markdownModal.chars', { count: rawContent.length })}
            </p>
          </div>
        </div>

        {/* 右上角操作区：Markdown/原始切换、复制、下载为.md、关闭 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 渲染视图切换 */}
          <div className="hidden sm:flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                activeTab === 'preview'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{t('markdownModal.preview', '渲染预览')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                activeTab === 'raw'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3 h-3" />
              <span>{t('markdownModal.raw', '原始内容')}</span>
            </button>
          </div>

          {/* 复制文本内容 */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-blue-600 text-xs font-medium transition active:scale-95 shadow-2xs"
            title="复制全部内容"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">{t('markdownModal.copied', '已复制')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('markdownModal.copy', '复制')}</span>
              </>
            )}
          </button>

          {/* 下载为 .md 文件 */}
          <button
            type="button"
            onClick={handleStartDownload}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition active:scale-95 shadow-2xs"
            title={t('markdownModal.downloadMd', '下载为 .md')}
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('markdownModal.downloadMd', '下载为 .md')}</span>
          </button>

          {/* 关闭 / 返回首页按钮 */}
          <button
            type="button"
            onClick={handleCloseClick}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition ml-1"
            title={isStandalone ? t('header.goHome', '返回首页') : t('records.close', '关闭')}
          >
            {isStandalone ? <ArrowLeft className="w-4 h-4" /> : <X className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* 内容展示主体区域 (长文本平滑滚动与排版优化) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-white selection:bg-blue-100 selection:text-blue-900 custom-scrollbar overscroll-contain relative scroll-smooth"
      >
        <div className="max-w-4xl mx-auto w-full p-5 sm:p-8 sm:px-12">
          {activeTab === 'preview' ? (
            <div
              className="markdown-content max-w-none text-slate-800 leading-relaxed text-sm selection:bg-blue-100"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          ) : (
            <pre className="font-mono text-xs sm:text-sm text-slate-800 bg-slate-50/80 p-5 rounded-2xl border border-slate-200 whitespace-pre-wrap break-words leading-relaxed select-text shadow-inner">
              {rawContent}
            </pre>
          )}
        </div>

        {/* 浮动“回到顶部”按钮 (长文本滚动超过一定距离时自动显示) */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed sm:absolute bottom-14 right-6 sm:right-10 z-20 flex items-center gap-1 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 shadow-md text-xs font-medium transition-all active:scale-95 animate-fade-in"
            title="回到顶部"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>回到顶部</span>
          </button>
        )}
      </div>

      {/* 底部信息条 (与设计图完全一致) */}
      <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <span>{t('markdownModal.footerEngine', 'EasyDrop Markdown 渲染引擎 · 支持 GFM 语法')}</span>
        <span>
          {isStandalone
            ? t('downloadPage.backHomeHint', '点击右上角返回 EasyDrop 首页')
            : t('markdownModal.escTip', '按 ESC 或点击右上角 X 关闭')}
        </span>
      </div>

      {/* 命名下载弹窗 (独立居中确认层) */}
      {showRenameDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">{t('markdownModal.dialogTitle', '导出 Markdown 文件')}</h4>
                <p className="text-[11px] text-slate-400">{t('markdownModal.dialogSubtitle', '请为下载的 .md 文件命名')}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('markdownModal.fileNameLabel', '文件名称')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={downloadFilename}
                  onChange={(e) => setDownloadFilename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmDownload();
                    if (e.key === 'Escape') setShowRenameDialog(false);
                  }}
                  placeholder="e.g. Note.md"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{t('markdownModal.autoExtTip', '若未输入后缀，系统将自动补全为 .md')}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRenameDialog(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition"
              >
                {t('markdownModal.cancel', '取消')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDownload}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition active:scale-95 shadow-sm shadow-blue-500/20"
              >
                {t('markdownModal.confirmDownload', '确认下载')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
