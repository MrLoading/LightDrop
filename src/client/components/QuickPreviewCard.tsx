import React, { useState } from 'react';
import {
  Clock,
  ArrowRight,
  FileText,
  File,
  HardDrive,
  Copy,
  Check,
  Download,
  CalendarDays,
  FolderArchive,
  Lock,
  Image as ImageIcon,
  Inbox,
  Eye,
  Layers,
  Images,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem, SystemStats } from '@shared/types';
import {
  formatBytes,
  formatDisplayTime,
  getFileTypeLabel,
  isImageItem,
  isMarkdownItem,
  isTextDocItem,
  isPdfItem,
  isDocPreviewable,
  getItemDisplayTitle,
} from '../utils/format';
import { PasswordModal } from './PasswordModal';
import { TextMarkdownModal } from './TextMarkdownModal';
import { ImageViewerModal } from './ImageViewerModal';
import { BatchViewerModal } from './BatchViewerModal';
import { PdfViewerModal } from './PdfViewerModal';
import { getCharacterInfo, getDisplayNickname } from '../utils/nickname';

export interface QuickPreviewCardProps {
  recentRecords: ShareItem[];
  stats: SystemStats;
  onScrollToRecords: () => void;
  onCopyText: (item: ShareItem, customText?: string) => Promise<boolean>;
  onDownloadFile: (item: ShareItem, password?: string) => void;
  verifyPassword: (id: string, password: string) => Promise<string>;
}

export const QuickPreviewCard: React.FC<QuickPreviewCardProps> = ({
  recentRecords,
  stats,
  onScrollToRecords,
  onCopyText,
  onDownloadFile,
  verifyPassword,
}) => {
  const { t, i18n } = useTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [markdownModalItem, setMarkdownModalItem] = useState<ShareItem | null>(null);
  const [imageViewerItem, setImageViewerItem] = useState<{ item: ShareItem; password?: string } | null>(null);
  const [batchViewerItem, setBatchViewerItem] = useState<{ item: ShareItem; password?: string } | null>(null);
  const [pdfViewerItem, setPdfViewerItem] = useState<{ item: ShareItem; password?: string } | null>(null);

  // 密码校验弹窗状态
  const [pwdModalState, setPwdModalState] = useState<{
    isOpen: boolean;
    item: ShareItem | null;
    actionType: 'copy' | 'download' | 'view_markdown' | 'view_image' | 'view_batch' | 'view_pdf';
  }>({
    isOpen: false,
    item: null,
    actionType: 'copy',
  });

  // 获取条目在卡片中的展示标题
  const getTextDisplayTitle = (item: ShareItem): string => {
    return getItemDisplayTitle(item, 20);
  };

  // 获取图标配置
  const getItemIcon = (item: ShareItem) => {
    if (item.type === 'text') {
      return (
        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (item.type === 'image') {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    if (item.type === 'folder') {
      return (
        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <FolderArchive className="w-4 h-4" />
        </div>
      );
    }
    if (item.type === 'batch') {
      if (item.content) {
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        );
      }
      if (item.isImageBatch) {
        return (
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <Images className="w-4 h-4" />
          </div>
        );
      }
      return (
        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4" />
        </div>
      );
    }
    const ext = (item.extension || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return (
        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
        <File className="w-4 h-4" />
      </div>
    );
  };

  // 点击复制 (若受密码保护且未解密，弹窗验证；已解密则直接复制)
  const handleCopyClick = async (item: ShareItem) => {
    if (item.hasPassword && !item.content) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'copy',
      });
      return;
    }

    const ok = await onCopyText(item, item.content);
    if (ok) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // 点击下载
  const handleDownloadClick = (item: ShareItem) => {
    if (item.hasPassword) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'download',
      });
      return;
    }
    onDownloadFile(item);
  };

  // 点击查看多文件合辑
  const handleViewBatchClick = (item: ShareItem) => {
    if (item.hasPassword && !item.password) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'view_batch',
      });
      return;
    }
    setBatchViewerItem({ item, password: item.password });
  };

  // 点击查看文本 / Markdown
  const handleViewClick = (item: ShareItem) => {
    if (item.hasPassword && !item.password && !item.content) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'view_markdown',
      });
      return;
    }
    setMarkdownModalItem(item);
  };

  // 点击查看 PDF
  const handleViewPdfClick = (item: ShareItem) => {
    if (item.hasPassword && !item.password) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'view_pdf',
      });
      return;
    }
    setPdfViewerItem({ item, password: item.password });
  };

  // 点击全屏查看图片
  const handleViewImageClick = (item: ShareItem) => {
    if (item.hasPassword && !item.password) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'view_image',
      });
      return;
    }
    setImageViewerItem({ item, password: item.password });
  };

  // 密码弹窗确认
  const handlePasswordConfirm = async (password: string) => {
    const item = pwdModalState.item;
    if (!item) return;

    if (pwdModalState.actionType === 'copy') {
      const decrypted = await verifyPassword(item.id, password);
      const ok = await onCopyText(item, decrypted);
      if (ok) {
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } else if (pwdModalState.actionType === 'download') {
      // 必须先校验密码，若密码错误抛出异常，由 PasswordModal 捕获并提示重新输入
      await verifyPassword(item.id, password);
      onDownloadFile(item, password);
    } else if (pwdModalState.actionType === 'view_markdown') {
      const decrypted = await verifyPassword(item.id, password);
      setMarkdownModalItem({
        ...item,
        content: decrypted,
        password,
      });
    } else if (pwdModalState.actionType === 'view_image') {
      await verifyPassword(item.id, password);
      setImageViewerItem({
        item: { ...item, password },
        password,
      });
    } else if (pwdModalState.actionType === 'view_pdf') {
      await verifyPassword(item.id, password);
      setPdfViewerItem({
        item: { ...item, password },
        password,
      });
    } else if (pwdModalState.actionType === 'view_batch') {
      await verifyPassword(item.id, password);
      setBatchViewerItem({
        item: { ...item, password },
        password,
      });
    }
  };

  // 显示最多 3 条记录
  const displayItems = recentRecords.slice(0, 3);
  // 不足 3 条时补足的占位槽位数
  const emptySlotsCount = Math.max(0, 3 - displayItems.length);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between h-full">
      {/* 头部标题与查看全部 */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-500" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">{t('preview.title')}</h2>
            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
              {t('preview.recentCount')}
            </span>
          </div>
          <button
            onClick={onScrollToRecords}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition"
          >
            {t('preview.viewAll')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 最近 3 条记录列表 */}
        <div className="py-3 flex flex-col gap-2.5">
          {displayItems.length === 0 ? (
            <div className="rounded-xl p-8 bg-slate-50/70 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Inbox className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-slate-500">{t('preview.emptyTitle')}</p>
              <p className="text-[11px] text-slate-400 mt-1">{t('preview.emptyDesc')}</p>
            </div>
          ) : (
            <>
              {displayItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50/80 hover:bg-slate-50 rounded-xl p-2.5 sm:p-3 border border-slate-200/60 transition group flex items-center justify-between gap-3 shadow-none hover:shadow-xs"
                >
                  {/* 左侧图标与文本信息 */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {getItemIcon(item)}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          onClick={() => {
                            if (item.type === 'text' || isMarkdownItem(item) || isTextDocItem(item)) {
                              handleViewClick(item);
                            } else if (item.type === 'batch') {
                              handleViewBatchClick(item);
                            } else if (isImageItem(item)) {
                              handleViewImageClick(item);
                            } else if (isPdfItem(item)) {
                              handleViewPdfClick(item);
                            } else {
                              handleDownloadClick(item);
                            }
                          }}
                          className="text-xs font-semibold text-slate-800 truncate cursor-pointer hover:text-blue-600"
                          title={getTextDisplayTitle(item)}
                        >
                          {getTextDisplayTitle(item)}
                        </span>

                        {item.hasPassword && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                            title={t('preview.passwordProtected')}
                          >
                            <Lock className="w-2.5 h-2.5 text-amber-600" />
                            {t('preview.encrypted')}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                        <span className="font-medium text-slate-600 flex items-center gap-0.5">
                          <span className="text-xs leading-none">{getCharacterInfo(item.senderName || item.nickname).emoji}</span>
                          <span>{getDisplayNickname(item.senderName || item.nickname, i18n.language)}</span>
                        </span>
                        <span>•</span>
                        <span>{formatDisplayTime(item.createdAt)}</span>
                        <span>•</span>
                        {item.type === 'text' && (
                          <span className="truncate">
                            {item.hasPassword
                              ? t('preview.passwordProtected')
                              : item.isUrl
                              ? t('preview.urlLink')
                              : t('preview.textSummary', { count: (item.content || item.title || '').length })}
                          </span>
                        )}
                        {item.type === 'image' && (
                          <span>
                            {formatBytes(item.fileSize)} · {t('preview.image')}
                          </span>
                        )}
                        {item.type === 'file' && (
                          <span>
                            {formatBytes(item.fileSize)} · {getFileTypeLabel(item.fileName, item.extension)}
                          </span>
                        )}
                        {item.type === 'folder' && (
                          <span>
                            {formatBytes(item.fileSize)} · {t('preview.folderWithCount', { count: item.fileCount || 0 })}
                          </span>
                        )}
                        {item.type === 'batch' && (
                          <span>
                            {item.content
                              ? `${formatBytes(item.fileSize)} · ${t('records.typeWithAttachments', '图文附件')} (${item.files?.length || 0})`
                              : `${formatBytes(item.fileSize)} · ${item.isImageBatch ? t('records.typeImageBatch', '图片合辑') : t('records.typeBatch', '文件合辑')} (${item.files?.length || 0})`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 右侧快捷操作按钮 */}
                  <div className="shrink-0 flex items-center">
                    {item.type === 'text' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={item.hasPassword && !item.content ? t('records.tipViewPwd') : t('preview.viewContent')}
                        >
                          {item.hasPassword && !item.content ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="text-[11px] hidden sm:inline">{t('preview.view')}</span>
                        </button>
                        <button
                          onClick={() => handleCopyClick(item)}
                          className={`p-1.5 rounded-lg border transition active:scale-95 flex items-center gap-1 text-xs font-medium ${
                            copiedId === item.id
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm'
                              : 'bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 border-slate-200 shadow-sm'
                          }`}
                          title={t('preview.copyContent')}
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="text-[11px] hidden sm:inline">{t('preview.copied')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-[11px] hidden sm:inline">{t('preview.copy')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : isImageItem(item) ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewImageClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('preview.viewFullscreen', '全屏查看')}
                        >
                          {item.hasPassword && !item.password ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="text-[11px] hidden sm:inline">{t('preview.view', '查看')}</span>
                        </button>
                        <button
                          onClick={() => handleDownloadClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('preview.download')}
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[11px] hidden sm:inline">{t('preview.download')}</span>
                        </button>
                      </div>
                    ) : item.type === 'batch' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewBatchClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('records.view', '查看')}
                        >
                          {item.hasPassword && !item.password ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="text-[11px] hidden sm:inline">{t('records.view', '查看')}</span>
                        </button>
                        <button
                          onClick={() => handleDownloadClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('records.downloadZip', '下载 ZIP')}
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[11px] hidden sm:inline">{t('records.downloadZip', '下载 ZIP')}</span>
                        </button>
                      </div>
                    ) : (isMarkdownItem(item) || isTextDocItem(item)) ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('preview.viewContent', '预览内容')}
                        >
                          {item.hasPassword && !item.content && !item.password ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="text-[11px] hidden sm:inline">{t('preview.view', '查看')}</span>
                        </button>
                        <button
                          onClick={() => handleDownloadClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('preview.download')}
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[11px] hidden sm:inline">{t('preview.download')}</span>
                        </button>
                      </div>
                    ) : isPdfItem(item) ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleViewPdfClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('preview.viewPdf', '在线预览 PDF')}
                        >
                          {item.hasPassword && !item.password ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="text-[11px] hidden sm:inline">{t('preview.view', '查看')}</span>
                        </button>
                        <button
                          onClick={() => handleDownloadClick(item)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                          title={t('preview.download')}
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[11px] hidden sm:inline">{t('preview.download')}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownloadClick(item)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-sm transition active:scale-95 flex items-center gap-1 text-xs font-medium"
                        title={item.type === 'folder' ? t('preview.downloadFolder') : t('preview.download')}
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] hidden sm:inline">{t('preview.download')}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* 当少于 3 条记录时，渲染柔和的虚线占位槽，保持高度稳定美观 */}
              {Array.from({ length: emptySlotsCount }).map((_, idx) => (
                <div
                  key={`empty-slot-${idx}`}
                  className="rounded-xl p-3 border border-dashed border-slate-200/70 bg-slate-50/30 flex items-center justify-center text-slate-400 text-xs gap-1.5 select-none"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  <span className="text-[11px] text-slate-400">{t('preview.waiting')}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 底部 3 项统计卡片 */}
      <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100">
        {/* 总记录数 */}
        <div
          onClick={onScrollToRecords}
          className="bg-slate-50/80 hover:bg-slate-100/80 rounded-xl p-2.5 border border-slate-200/60 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 truncate">{t('preview.totalRecords')}</div>
              <div className="text-sm font-bold text-slate-800 leading-tight">{stats.totalRecords}</div>
            </div>
          </div>
          <span className="text-xs text-slate-300 group-hover:text-slate-500 font-mono transition shrink-0 ml-1">›</span>
        </div>

        {/* 总文件大小 */}
        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/60 flex items-center justify-between group">
          <div className="flex items-center gap-2 min-w-0">
            <HardDrive className="w-4 h-4 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 truncate">{t('preview.totalStorage')}</div>
              <div className="text-sm font-bold text-slate-800 leading-tight truncate">
                {formatBytes(stats.totalStorageBytes)}
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-300 font-mono shrink-0 ml-1">›</span>
        </div>

        {/* 今日发送 */}
        <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/60 flex items-center justify-between group">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-slate-400 truncate">{t('preview.todaySent')}</div>
              <div className="text-sm font-bold text-slate-800 leading-tight">{stats.todaySentCount}</div>
            </div>
          </div>
          <span className="text-xs text-slate-300 font-mono shrink-0 ml-1">›</span>
        </div>
      </div>

      {/* 密码验证弹窗 */}
      <PasswordModal
        isOpen={pwdModalState.isOpen}
        onClose={() => setPwdModalState({ isOpen: false, item: null, actionType: 'copy' })}
        title={pwdModalState.item?.title || pwdModalState.item?.fileName || t('preview.protectedRecord')}
        actionType={pwdModalState.actionType}
        onConfirm={handlePasswordConfirm}
      />

      {/* 文本 Markdown 渲染大弹窗 */}
      {markdownModalItem && (
        <TextMarkdownModal
          item={markdownModalItem}
          password={markdownModalItem.password}
          isOpen={Boolean(markdownModalItem)}
          onClose={() => setMarkdownModalItem(null)}
        />
      )}

      {/* 图片全屏查看大弹窗 */}
      {imageViewerItem && (
        <ImageViewerModal
          isOpen={Boolean(imageViewerItem)}
          onClose={() => setImageViewerItem(null)}
          item={imageViewerItem.item}
          allImageItems={recentRecords.filter(isImageItem)}
          password={imageViewerItem.password}
          onDownload={onDownloadFile}
        />
      )}

      {/* 批量多文件合辑大弹窗 */}
      {batchViewerItem && (
        <BatchViewerModal
          isOpen={Boolean(batchViewerItem)}
          onClose={() => setBatchViewerItem(null)}
          item={batchViewerItem.item}
          password={batchViewerItem.password}
          onDownloadBatch={onDownloadFile}
          verifyPassword={verifyPassword}
        />
      )}

      {/* PDF 文件在线预览大弹窗 */}
      {pdfViewerItem && (
        <PdfViewerModal
          isOpen={Boolean(pdfViewerItem)}
          onClose={() => setPdfViewerItem(null)}
          item={pdfViewerItem.item}
          password={pdfViewerItem.password}
          onDownload={onDownloadFile}
        />
      )}
    </div>
  );
};
