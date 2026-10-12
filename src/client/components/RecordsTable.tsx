import React, { useState, useMemo } from 'react';
import {
  FileText,
  File,
  Folder,
  Search,
  Trash2,
  Download,
  Copy,
  Check,
  Globe,
  ExternalLink,
  MoreHorizontal,
  FolderArchive,
  Image as ImageIcon,
  FileCode,
  Lock,
  ShieldCheck,
  Link2,
  QrCode,
  Eye,
  Maximize2,
  ChevronDown,
  Layers,
  Images,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem, ShareItemType, SystemStats } from '@shared/types';
import { formatBytes, formatDisplayTime, getFileTypeLabel, isImageItem } from '../utils/format';
import { copyToClipboard } from '../utils/clipboard';
import { PasswordModal } from './PasswordModal';
import { AuditLogModal } from './AuditLogModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { FileQrModal } from './FileQrModal';
import { TextMarkdownModal } from './TextMarkdownModal';
import { ShareInfoModal } from './ShareInfoModal';
import { ClearRecordsModal, ClearRecordsOptions } from './ClearRecordsModal';
import { ImageViewerModal } from './ImageViewerModal';
import { BatchViewerModal } from './BatchViewerModal';
import { getCharacterInfo, getDisplayNickname } from '../utils/nickname';

interface RecordsTableProps {
  records: ShareItem[];
  stats: SystemStats;
  currentAccessUrl?: string;
  activeTab: 'all' | ShareItemType;
  setActiveTab: (tab: 'all' | ShareItemType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  onCopyText: (item: ShareItem, customText?: string) => Promise<boolean>;
  onDownload: (item: ShareItem, password?: string) => void;
  onDeleteOne: (id: string) => void;
  onBatchDelete: () => void;
  onClearAll: (options?: ClearRecordsOptions) => Promise<any> | void;
  verifyPassword: (id: string, password: string) => Promise<string>;
  onCopyShareLink?: (id: string) => void;
}

export const RecordsTable: React.FC<RecordsTableProps> = ({
  records,
  stats,
  currentAccessUrl,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  selectedIds,
  toggleSelect,
  toggleSelectAll,
  onCopyText,
  onDownload,
  onDeleteOne,
  onBatchDelete,
  onClearAll,
  verifyPassword,
  onCopyShareLink,
}) => {
  const { t, i18n } = useTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ShareItem | null>(null);
  const [markdownModalItem, setMarkdownModalItem] = useState<ShareItem | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [copiedDownloadId, setCopiedDownloadId] = useState<string | null>(null);
  const [copiedViewId, setCopiedViewId] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<{ id: string; type: 'copy' | 'qr' } | null>(null);
  const [fileQrData, setFileQrData] = useState<{ item: ShareItem; downloadUrl: string; mode?: 'download' | 'view' } | null>(null);
  const [shareModalItem, setShareModalItem] = useState<ShareItem | null>(null);
  const [clearRecordsModalOpen, setClearRecordsModalOpen] = useState(false);
  const [batchViewerItem, setBatchViewerItem] = useState<{ item: ShareItem; password?: string } | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);

  // 获取文件直接下载直链 (直接向 download 接口请求)
  const getItemDirectUrl = (item: ShareItem): string => {
    const origin = (currentAccessUrl || window.location.origin).replace(/\/+$/, '');
    const baseUrl = `${origin}/api/records/${item.id}/download`;
    if (item.hasPassword && item.password) {
      return `${baseUrl}?password=${encodeURIComponent(item.password)}`;
    }
    return baseUrl;
  };

  // 获取分享提取页面直链 (若有密码则优先指向提取页面)
  const getItemShareUrl = (item: ShareItem): string => {
    const origin = (currentAccessUrl || window.location.origin).replace(/\/+$/, '');
    if (item.hasPassword) {
      const baseUrl = `${origin}/download/${item.id}`;
      return item.password ? `${baseUrl}?pwd=${encodeURIComponent(item.password)}` : baseUrl;
    }
    return `${origin}/api/records/${item.id}/download`;
  };

  // 获取查看详情页面直链 (打开照片查看详情/文本阅读/文件信息)
  const getItemViewUrl = (item: ShareItem): string => {
    const origin = (currentAccessUrl || window.location.origin).replace(/\/+$/, '');
    const baseUrl = `${origin}/view/${item.id}`;
    return item.hasPassword && item.password ? `${baseUrl}?pwd=${encodeURIComponent(item.password)}` : baseUrl;
  };

  // 复制下载链接 (若存在密码且无明文密码，展开小弹窗展示详情)
  const handleCopyDownloadLink = async (item: ShareItem) => {
    setActiveDropdown(null);
    if (item.hasPassword && !item.password) {
      setShareModalItem(item);
      return;
    }

    const link = getItemDirectUrl(item);
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopiedDownloadId(item.id);
      setCopiedLinkId(item.id);
      setTimeout(() => {
        setCopiedDownloadId(null);
        setCopiedLinkId(null);
      }, 2000);
      onCopyShareLink?.(item.id);
    }
  };

  // 复制查看链接 (打开详情/图二大图/文本阅读界面)
  const handleCopyViewLink = async (item: ShareItem) => {
    setActiveDropdown(null);
    const link = getItemViewUrl(item);
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopiedViewId(item.id);
      setCopiedLinkId(item.id);
      setTimeout(() => {
        setCopiedViewId(null);
        setCopiedLinkId(null);
      }, 2000);
      onCopyShareLink?.(item.id);
    }
  };

  // 发送文字内容，摘录前15个字符作为内容/文件名
  const getTextDisplayTitle = (item: ShareItem): string => {
    if (item.type !== 'text') return item.title || item.fileName || 'Item';
    const raw = item.title || item.content || 'Text';
    const oneLine = raw.replace(/\s+/g, ' ').trim();
    return oneLine.length > 15 ? `${oneLine.substring(0, 15)}...` : oneLine;
  };

  // 打开二维码弹窗 (支持下载模式与查看模式)
  const handleOpenItemQr = (item: ShareItem, mode: 'download' | 'view' = 'download') => {
    setActiveDropdown(null);
    const link = mode === 'view' ? getItemViewUrl(item) : getItemShareUrl(item);
    setFileQrData({
      item,
      downloadUrl: link,
      mode,
    });
  };

  // 删除操作确认弹窗状态
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    subContent?: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    content: '',
    onConfirm: () => {},
  });

  const triggerDeleteOne = (item: ShareItem) => {
    setDeleteModalState({
      isOpen: true,
      title: t('records.delModalTitle'),
      content: t('records.delModalContent', { title: item.title || item.fileName || 'Item' }),
      subContent: t('records.delModalSub'),
      confirmText: t('records.delModalConfirm'),
      onConfirm: () => {
        onDeleteOne(item.id);
        setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const triggerBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteModalState({
      isOpen: true,
      title: t('records.batchDelModalTitle'),
      content: t('records.batchDelModalContent', { count: selectedIds.size }),
      subContent: t('records.batchDelModalSub'),
      confirmText: t('records.batchDelModalConfirm', { count: selectedIds.size }),
      onConfirm: () => {
        onBatchDelete();
        setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const triggerClearAll = () => {
    if (records.length === 0 && stats.totalRecords === 0) return;
    setClearRecordsModalOpen(true);
  };

  // 密码验证弹窗状态
  const [pwdModalState, setPwdModalState] = useState<{
    isOpen: boolean;
    item: ShareItem | null;
    actionType: 'copy' | 'download' | 'preview' | 'view_markdown' | 'view_image' | 'view_batch';
  }>({
    isOpen: false,
    item: null,
    actionType: 'copy',
  });

  // 全屏查看图片状态
  const [imageViewerItem, setImageViewerItem] = useState<{ item: ShareItem; password?: string } | null>(null);

  // 获取当前所有图片记录，供全屏查看时快速上/下一张切换
  const allImageItems = useMemo(() => {
    return records.filter((r) => isImageItem(r));
  }, [records]);

  // 触发复制 (若文本受密码保护且尚未解密，先弹窗校验；若已解密则直接复制)
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

  // 触发下载
  const handleDownloadClick = (item: ShareItem) => {
    if (item.hasPassword) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'download',
      });
      return;
    }
    onDownload(item);
  };

  // 触发查看多文件合辑
  const handleViewBatchClick = async (item: ShareItem) => {
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

  // 触发查看详情
  const handlePreviewClick = (item: ShareItem) => {
    if (item.type === 'batch') {
      handleViewBatchClick(item);
      return;
    }
    if (item.hasPassword && item.type === 'text' && !item.content) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'preview',
      });
      return;
    }
    setPreviewItem(item);
  };

  // 触发全屏查看图片
  const handleViewImageClick = async (item: ShareItem) => {
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

  // 触发查看 Markdown 大弹窗
  const handleViewMarkdownClick = async (item: ShareItem) => {
    if (item.hasPassword && !item.content) {
      setPwdModalState({
        isOpen: true,
        item,
        actionType: 'view_markdown',
      });
      return;
    }
    setMarkdownModalItem(item);
  };

  // 批量勾选打包下载 ZIP
  const handleBatchDownloadZip = async () => {
    if (selectedIds.size === 0) return;
    setBatchDownloading(true);
    try {
      const res = await fetch('/api/records/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '批量下载失败');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      let filename = `LightDrop_批量打包_${new Date().toISOString().slice(0, 10)}.zip`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1].replace(/["']/g, ''));
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || '批量下载失败');
    } finally {
      setBatchDownloading(false);
    }
  };

  // 密码弹窗提交确认
  const handlePasswordConfirm = async (password: string) => {
    const item = pwdModalState.item;
    if (!item) return;

    if (pwdModalState.actionType === 'copy') {
      const decryptedContent = await verifyPassword(item.id, password);
      const ok = await onCopyText(item, decryptedContent);
      if (ok) {
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } else if (pwdModalState.actionType === 'download') {
      // 必须先校验密码，若密码错误将抛出异常并由 PasswordModal 捕获提示，防止错误直跳
      await verifyPassword(item.id, password);
      onDownload(item, password);
    } else if (pwdModalState.actionType === 'preview') {
      const decryptedContent = await verifyPassword(item.id, password);
      setPreviewItem({
        ...item,
        content: decryptedContent,
      });
    } else if (pwdModalState.actionType === 'view_markdown') {
      const decryptedContent = await verifyPassword(item.id, password);
      setMarkdownModalItem({
        ...item,
        content: decryptedContent,
      });
    } else if (pwdModalState.actionType === 'view_image') {
      await verifyPassword(item.id, password);
      setImageViewerItem({
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

  // 渲染通用的“复制链接”与“二维码”下拉展开按钮 (全部类型通用)
  const renderActionDropdowns = (targetItem: ShareItem) => {
    const isCopyOpen = activeDropdown?.id === targetItem.id && activeDropdown?.type === 'copy';
    const isQrOpen = activeDropdown?.id === targetItem.id && activeDropdown?.type === 'qr';
    const isCopied = copiedLinkId === targetItem.id;
    const itemIndex = records.findIndex((r) => r.id === targetItem.id);
    const isNearBottom = itemIndex >= 0 && itemIndex >= records.length - 2 && records.length >= 3;
    const menuPositionClass = isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5';

    return (
      <div className="inline-flex items-center gap-1.5 shrink-0">
        {/* 复制链接下拉展开按钮 */}
        <div className="relative inline-block text-left shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown((prev) =>
                prev?.id === targetItem.id && prev?.type === 'copy' ? null : { id: targetItem.id, type: 'copy' }
              );
            }}
            className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium shadow-2xs transition active:scale-95 whitespace-nowrap shrink-0 ${
              isCopyOpen
                ? 'border-blue-400 bg-blue-50/70 text-blue-600 ring-2 ring-blue-100'
                : 'border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 bg-white'
            }`}
            title={t('records.copyLink')}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-emerald-600 whitespace-nowrap">{t('records.copied')}</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="whitespace-nowrap">{t('records.copyLink')}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 -ml-0.5" />
              </>
            )}
          </button>

          {isCopyOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute right-0 ${menuPositionClass} w-36 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-30 animate-fade-in divide-y divide-slate-100/80`}
            >
              <button
                type="button"
                onClick={() => handleCopyDownloadLink(targetItem)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition text-left group"
                title={t('records.tipDownloadLink')}
              >
                <span className="flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                  <span>{t('records.downloadLink')}</span>
                </span>
                {copiedDownloadId === targetItem.id && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
              </button>
              <button
                type="button"
                onClick={() => handleCopyViewLink(targetItem)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 transition text-left group"
                title={t('records.tipViewLink')}
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                  <span>{t('records.viewLink')}</span>
                </span>
                {copiedViewId === targetItem.id && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
              </button>
            </div>
          )}
        </div>

        {/* 二维码下拉展开按钮 */}
        <div className="relative inline-block text-left shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveDropdown((prev) =>
                prev?.id === targetItem.id && prev?.type === 'qr' ? null : { id: targetItem.id, type: 'qr' }
              );
            }}
            className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium shadow-2xs transition active:scale-95 whitespace-nowrap shrink-0 ${
              isQrOpen
                ? 'border-blue-400 bg-blue-50/70 text-blue-600 ring-2 ring-blue-100'
                : 'border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 bg-white'
            }`}
            title={t('records.qr')}
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="whitespace-nowrap">{t('records.qr')}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 -ml-0.5" />
          </button>

          {isQrOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute right-0 ${menuPositionClass} w-36 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-30 animate-fade-in divide-y divide-slate-100/80`}
            >
              <button
                type="button"
                onClick={() => handleOpenItemQr(targetItem, 'download')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition text-left group"
                title={t('records.tipQrDownload')}
              >
                <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                <span>{t('records.downloadLink')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenItemQr(targetItem, 'view')}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:text-emerald-600 hover:bg-emerald-50/70 transition text-left group"
                title={t('records.tipQrView')}
              >
                <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                <span>{t('records.viewLink')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getRecordIcon = (item: ShareItem) => {
    if (item.type === 'text') {
      return (
        <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
      );
    }
    if (item.type === 'image') {
      return (
        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    if (item.type === 'folder') {
      return (
        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <Folder className="w-4 h-4 fill-amber-500 stroke-none" />
        </div>
      );
    }
    if (item.type === 'batch') {
      if (item.isImageBatch) {
        return (
          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <Images className="w-4 h-4" />
          </div>
        );
      }
      return (
        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4" />
        </div>
      );
    }

    const ext = (item.extension || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      return (
        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
      );
    }
    if (['pdf'].includes(ext)) {
      return (
        <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <File className="w-4 h-4" />
        </div>
      );
    }
    if (['ts', 'js', 'py', 'java', 'html', 'json'].includes(ext)) {
      return (
        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
          <FileCode className="w-4 h-4" />
        </div>
      );
    }
    if (['zip', 'rar', 'tar', 'gz'].includes(ext)) {
      return (
        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
          <FolderArchive className="w-4 h-4" />
        </div>
      );
    }

    return (
      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
        <File className="w-4 h-4" />
      </div>
    );
  };

  const getFileLargeIcon = (item: ShareItem) => {
    if (item.type === 'folder') {
      return (
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs border border-amber-200/60">
          <FolderArchive className="w-7 h-7" />
        </div>
      );
    }
    if (item.type === 'batch') {
      if (item.isImageBatch) {
        return (
          <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 shadow-xs border border-purple-200/60">
            <Images className="w-7 h-7" />
          </div>
        );
      }
      return (
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs border border-indigo-200/60">
          <Layers className="w-7 h-7" />
        </div>
      );
    }
    const ext = (item.extension || (item.fileName ? item.fileName.split('.').pop() : '') || '').toLowerCase();
    if (['doc', 'docx'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-xs border border-blue-200/60">
          <FileText className="w-7 h-7" />
        </div>
      );
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs border border-emerald-200/60">
          <FileText className="w-7 h-7" />
        </div>
      );
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 shadow-xs border border-orange-200/60">
          <FileText className="w-7 h-7" />
        </div>
      );
    }
    if (['pdf'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs border border-rose-200/60">
          <File className="w-7 h-7" />
        </div>
      );
    }
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 shadow-xs border border-purple-200/60">
          <FolderArchive className="w-7 h-7" />
        </div>
      );
    }
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'sql', 'sh'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0 shadow-xs border border-violet-200/60">
          <FileCode className="w-7 h-7" />
        </div>
      );
    }
    return (
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs border border-indigo-200/60">
        <File className="w-7 h-7" />
      </div>
    );
  };

  const isAllSelected = records.length > 0 && selectedIds.size === records.length;

  return (
    <div id="records-section" className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden relative">
      {/* 点击外部区域收起下拉菜单 */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => setActiveDropdown(null)}
        />
      )}

      {/* 顶部操作工具栏 */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* 左侧：标题与分类药丸 */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">{t('records.title')}</h2>
          </div>

          {/* 分类 Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t('records.tabAll')} ({stats.totalRecords})
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeTab === 'text'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t('records.tabText')} ({stats.textCount})
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeTab === 'image'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t('records.tabImage')} ({stats.imageCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeTab === 'file'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t('records.tabFile')} ({stats.fileCount})
            </button>
            <button
              onClick={() => setActiveTab('folder')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                activeTab === 'folder'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {t('records.tabFolder')} ({stats.folderCount})
            </button>
          </div>
        </div>

        {/* 右侧：搜索框与批量操作 */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 搜索框 */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('records.searchPlaceholder')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700 placeholder-slate-400 transition"
            />
          </div>

          {/* 全选 */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer pl-1">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <span>{t('records.selectAll')}{selectedIds.size > 0 ? t('records.selectedCount', { count: selectedIds.size }) : ''}</span>
          </label>

          {/* 批量下载与批量清理 */}
          {selectedIds.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleBatchDownloadZip}
                disabled={batchDownloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100/90 rounded-xl text-xs font-medium transition active:scale-95 disabled:opacity-50"
                title={t('records.batchDownloadTip', '将选中的记录打包为 ZIP 下载')}
              >
                <Download className={`w-3.5 h-3.5 ${batchDownloading ? 'animate-bounce' : ''}`} />
                <span>{batchDownloading ? t('records.batchDownloading', '打包中...') : t('records.batchDownloadZip', '批量下载 (ZIP)')}</span>
              </button>

              <button
                onClick={triggerBatchDelete}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-medium transition active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('records.batchDelete')}
              </button>
            </>
          )}

          {/* 一键清空全部 */}
          <button
            onClick={triggerClearAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl text-xs font-medium shadow-sm transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('records.clearAll')}
          </button>

          {/* 操作审计按钮 */}
          <button
            type="button"
            onClick={() => setAuditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 active:scale-95 rounded-xl text-xs font-semibold shadow-xs transition"
            title={t('records.auditLogTitle')}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t('records.auditLog')}</span>
          </button>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1020px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-medium text-slate-400 select-none whitespace-nowrap">
              <th className="py-2.5 px-4 w-10 text-center shrink-0"></th>
              <th className="py-2.5 px-3 w-24 shrink-0">{t('records.thType')}</th>
              <th className="py-2.5 px-4 min-w-[220px] max-w-[460px]">{t('records.thContent')}</th>
              <th className="py-2.5 px-3 w-28 shrink-0 text-center">{t('records.thSender', '发送者')}</th>
              <th className="py-2.5 px-4 w-28 shrink-0">{t('records.thTime')}</th>
              <th className="py-2.5 px-4 w-32 shrink-0 text-center">{t('records.thPermission')}</th>
              <th className="py-2.5 px-4 min-w-[390px] shrink-0 text-right">{t('records.thActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Search className="w-5 h-5" />
                    </div>
                    <span>{t('records.emptySearch')}</span>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={`transition group ${
                      isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* 复选框 */}
                    <td className="py-3 px-4 text-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>

                    {/* 类型 */}
                    <td className="py-3 px-3 whitespace-nowrap shrink-0">
                      <div
                        className={`flex items-center gap-1.5 whitespace-nowrap ${
                          isImageItem(item) || item.type === 'batch' ? 'cursor-pointer group/type' : ''
                        }`}
                        onClick={() => {
                          if (item.type === 'batch') {
                            handleViewBatchClick(item);
                          } else if (isImageItem(item)) {
                            handleViewImageClick(item);
                          }
                        }}
                        title={
                          item.type === 'batch'
                            ? item.isImageBatch
                              ? t('records.clickToViewBatchImages', '点击浏览图片合辑')
                              : t('records.clickToViewBatchFiles', '点击浏览文件合辑')
                            : isImageItem(item)
                            ? t('records.clickToViewImage', '点击全屏查看图片')
                            : undefined
                        }
                      >
                        {getRecordIcon(item)}
                        <span
                          className={`font-medium whitespace-nowrap transition ${
                            isImageItem(item) || item.type === 'batch'
                              ? 'text-slate-600 group-hover/type:text-blue-600 group-hover/type:underline underline-offset-2'
                              : 'text-slate-600'
                          }`}
                        >
                          {item.type === 'text'
                            ? t('records.typeText')
                            : item.type === 'image'
                            ? t('records.typeImage')
                            : item.type === 'folder'
                            ? t('records.typeFolder')
                            : item.type === 'batch'
                            ? item.isImageBatch
                              ? t('records.typeImageBatch', '图片合辑')
                              : t('records.typeBatch', '文件合辑')
                            : t('records.typeFile')}
                        </span>
                      </div>
                    </td>

                    {/* 内容 / 文件名 */}
                    <td className="py-3 px-4 min-w-[220px] max-w-[460px]">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {item.isUrl ? (
                            <a
                              href={item.content}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-blue-600 hover:underline flex items-center gap-1 truncate max-w-full"
                              title={item.content || item.title}
                            >
                              <span className="truncate">{getTextDisplayTitle(item)}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span
                              onClick={() => {
                                if (item.type === 'text') {
                                  handleViewMarkdownClick(item);
                                } else if (item.type === 'batch') {
                                  handleViewBatchClick(item);
                                } else if (isImageItem(item)) {
                                  handleViewImageClick(item);
                                } else {
                                  handlePreviewClick(item);
                                }
                              }}
                              className="font-medium text-slate-800 hover:text-blue-600 cursor-pointer truncate max-w-full"
                              title={item.type === 'text' ? item.content || item.title : item.fileName || item.title}
                            >
                              {getTextDisplayTitle(item)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 min-w-0">
                          <span className="shrink-0">{formatBytes(item.fileSize)}</span>
                          <span className="shrink-0 text-slate-300">·</span>
                          <span className="truncate">
                            {item.type === 'text'
                              ? item.isUrl
                                ? t('records.webUrl')
                                : t('records.textSummary', { count: (item.content || item.title || '').length })
                              : item.type === 'folder'
                              ? t('preview.folderWithCount', { count: item.fileCount || 0 })
                              : item.type === 'batch'
                              ? t('records.batchCountSummary', '共 {{count}} 个文件，{{size}}', {
                                  count: item.files?.length || 0,
                                  size: formatBytes(item.fileSize),
                                })
                              : item.type === 'image'
                              ? t('records.imageFile')
                              : getFileTypeLabel(item.fileName, item.extension, item.mimeType)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 发送者 / 角色昵称 */}
                    <td className="py-3 px-3 whitespace-nowrap shrink-0 text-center align-middle">
                      <div className="flex items-center justify-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100/90 text-slate-700 border border-slate-200/60 max-w-[130px] truncate"
                          title={getDisplayNickname(item.senderName || item.nickname, i18n.language)}
                        >
                          <span className="text-xs leading-none shrink-0">
                            {getCharacterInfo(item.senderName || item.nickname).emoji}
                          </span>
                          <span className="truncate">{getDisplayNickname(item.senderName || item.nickname, i18n.language)}</span>
                        </span>
                      </div>
                    </td>

                    {/* 发送时间 */}
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap shrink-0">
                      {formatDisplayTime(item.createdAt)}
                    </td>

                    {/* 访问权限：优化为“局域网”与“密码”两种 */}
                    <td className="py-3 px-4 whitespace-nowrap shrink-0 text-center align-middle">
                      <div className="flex items-center justify-center">
                        {item.hasPassword ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap"
                            title={t('records.pwdProtectedTitle')}
                          >
                            <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>{t('records.permPassword', '密码')}</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200/50 whitespace-nowrap"
                            title={t('records.permLanTitle', '局域网内任意访客免密访问')}
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span>{t('records.permLan', '局域网')}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 操作列：单行绝不折行 */}
                    <td className="py-3 px-4 text-right whitespace-nowrap shrink-0 min-w-[390px]">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {item.type === 'text' ? (
                          <>
                            {/* 查看 Markdown 内容 */}
                            <button
                              onClick={() => handleViewMarkdownClick(item)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200/90 text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 bg-white text-[11px] font-medium shadow-xs transition active:scale-95 whitespace-nowrap shrink-0"
                              title={item.hasPassword && !item.content ? t('records.tipViewPwd') : t('records.tipViewMarkdown')}
                            >
                              {item.hasPassword && !item.content ? (
                                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span className="whitespace-nowrap">{t('records.view')}</span>
                            </button>

                            {/* 复制文本内容 */}
                            <button
                              onClick={() => handleCopyClick(item)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200/90 text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 bg-white text-[11px] font-medium shadow-xs transition active:scale-95 whitespace-nowrap shrink-0"
                              title={item.hasPassword && !item.content ? t('records.tipCopyPwd') : t('records.tipCopy')}
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span className="text-emerald-600 whitespace-nowrap">{t('records.copied')}</span>
                                </>
                              ) : (
                                <>
                                  {item.hasPassword && !item.content ? (
                                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span className="whitespace-nowrap">{t('records.copy')}</span>
                                </>
                              )}
                            </button>

                              {/* 复制链接与二维码下拉菜单 (支持下载链接与查看链接) */}
                              {renderActionDropdowns(item)}
                            </>
                          ) : item.type === 'batch' ? (
                            <>
                              {/* 查看合辑内容 */}
                              <button
                                onClick={() => handleViewBatchClick(item)}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200/90 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/70 bg-white text-[11px] font-medium shadow-xs transition active:scale-95 whitespace-nowrap shrink-0"
                                title={item.hasPassword && !item.password ? t('records.tipViewPwd') : t('records.tipViewBatch', '查看合辑内容与文件')}
                              >
                                {item.hasPassword && !item.password ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="whitespace-nowrap">{t('records.view', '查看')}</span>
                              </button>

                              {/* 打包下载合辑 ZIP */}
                              <button
                                onClick={() => handleDownloadClick(item)}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200/90 text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 bg-white text-[11px] font-medium shadow-xs transition active:scale-95 whitespace-nowrap shrink-0"
                                title={item.hasPassword ? t('records.tipDownloadPwd') : t('records.tipDownloadBatch', '打包下载合辑 ZIP')}
                              >
                                {item.hasPassword ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="whitespace-nowrap">{t('records.downloadZip', '下载 ZIP')}</span>
                              </button>

                              {/* 复制链接与二维码下拉菜单 (支持下载链接与查看链接) */}
                              {renderActionDropdowns(item)}
                            </>
                          ) : (
                            <>
                              {/* 下载文件 */}
                              <button
                                onClick={() => handleDownloadClick(item)}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200/90 text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 bg-white text-[11px] font-medium shadow-xs transition active:scale-95 whitespace-nowrap shrink-0"
                                title={item.hasPassword ? t('records.tipDownloadPwd') : t('records.tipDownload')}
                              >
                                {item.hasPassword ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span className="whitespace-nowrap">{t('records.download')}</span>
                              </button>

                              {/* 复制链接与二维码下拉菜单 (支持下载链接与查看链接) */}
                              {renderActionDropdowns(item)}
                            </>
                          )}

                        {/* 删除记录 */}
                        <button
                          onClick={() => triggerDeleteOne(item)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-500 hover:text-rose-600 hover:bg-rose-100/80 border border-rose-100 text-[11px] font-medium transition active:scale-95 whitespace-nowrap shrink-0"
                          title={t('records.tipDelete')}
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="whitespace-nowrap">{t('records.delete')}</span>
                        </button>

                        {/* 更多详情 */}
                        <button
                          onClick={() => handlePreviewClick(item)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition whitespace-nowrap shrink-0"
                          title={t('records.tipDetails')}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 文本/记录详情预览弹窗 */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getRecordIcon(previewItem)}
                <h3 className="text-sm font-bold text-slate-800 truncate max-w-[320px]">
                  {previewItem.title}
                </h3>
                {previewItem.hasPassword && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <Lock className="w-2.5 h-2.5" />
                    {t('records.previewEncrypted')}
                  </span>
                )}
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="text-xs text-slate-500 flex justify-between flex-wrap gap-2">
                <span>{t('records.previewType', { type: previewItem.type })}</span>
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <span>{getCharacterInfo(previewItem.senderName || previewItem.nickname).emoji}</span>
                  <span>{t('records.previewSender', '发送者: {{sender}}', { sender: getDisplayNickname(previewItem.senderName || previewItem.nickname, i18n.language) })}</span>
                </span>
                <span>{t('records.previewSize', { size: formatBytes(previewItem.fileSize) })}</span>
                <span>{t('records.previewTime', { time: formatDisplayTime(previewItem.createdAt) })}</span>
              </div>

              {isImageItem(previewItem) ? (
                <div
                  onClick={() => handleViewImageClick(previewItem)}
                  className="relative group/img flex justify-center p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 max-h-64 overflow-hidden cursor-zoom-in transition"
                  title={t('records.clickToViewImage', '点击全屏查看图片')}
                >
                  <img
                    src={getItemDirectUrl(previewItem)}
                    alt={previewItem.title || previewItem.fileName}
                    className="max-h-60 object-contain rounded-lg shadow-2xs group-hover/img:scale-[1.02] transition duration-200"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-all duration-200 rounded-xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/75 text-white text-xs font-medium shadow-lg backdrop-blur-md">
                      <Maximize2 className="w-3.5 h-3.5 text-white" />
                      {t('preview.clickToFullscreen', '点击全屏查看')}
                    </span>
                  </div>
                </div>
              ) : previewItem.type === 'text' ? (
                previewItem.hasPassword && !previewItem.content ? (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-amber-900">{t('records.textPasswordProtected')}</p>
                      <p className="text-[11px] text-amber-700/80 mt-0.5">{t('records.verifyPasswordToRead')}</p>
                    </div>
                    <button
                      onClick={() => {
                        setPwdModalState({
                          isOpen: true,
                          item: previewItem,
                          actionType: 'preview',
                        });
                      }}
                      className="mt-1 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-xs transition"
                    >
                      {t('records.enterPasswordToView')}
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-3 text-xs font-mono text-slate-700 max-h-60 overflow-y-auto whitespace-pre-wrap select-text border border-slate-200/80">
                    {previewItem.content || t('records.noContent')}
                  </div>
                )
              ) : (
                /* 文件或文件夹类型详情卡片 */
                <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/70 flex flex-col gap-3">
                  <div className="flex items-center gap-3.5">
                    {getFileLargeIcon(previewItem)}
                    <div className="flex flex-col min-w-0 flex-1">
                      <h4
                        className="text-xs sm:text-sm font-semibold text-slate-800 truncate"
                        title={previewItem.fileName || previewItem.title}
                      >
                        {previewItem.fileName || previewItem.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                        <span className="font-medium text-slate-700">{formatBytes(previewItem.fileSize)}</span>
                        <span>·</span>
                        <span>{getFileTypeLabel(previewItem.fileName, previewItem.extension, previewItem.mimeType)}</span>
                        {previewItem.extension && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200/80 text-[10px] font-bold text-slate-600 uppercase font-mono">
                            {previewItem.extension}
                          </span>
                        )}
                        {previewItem.type === 'folder' && previewItem.fileCount !== undefined && (
                          <span className="text-amber-700 font-medium">
                            ({t('preview.folderWithCount', { count: previewItem.fileCount })})
                          </span>
                        )}
                        {previewItem.type === 'batch' && (
                          <span className="text-indigo-700 font-medium">
                            ({t('send.filesCount', '{{count}} 个文件', { count: previewItem.files?.length || 0 })})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 权限状态提示横幅 */}
                  {previewItem.hasPassword ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-800 text-xs">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0 flex-1 leading-snug">
                        <span className="font-medium">{t('records.fileEncryptedStatus')}</span>
                        <span className="text-[11px] text-amber-700/80 block sm:inline sm:ml-1.5">
                          {t('records.fileEncryptedTip')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0 flex-1 leading-snug">
                        <span className="font-medium">{t('records.filePublicStatus')}</span>
                        <span className="text-[11px] text-emerald-700/80 block sm:inline sm:ml-1.5">
                          {t('records.filePublicTip')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 快捷操作：复制链接与二维码 (支持下载链接与查看链接) */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs text-slate-500">
                    <span className="text-[11px] text-slate-400">
                      {t('records.tipClickDownloadBelow')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {renderActionDropdowns(previewItem)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {isImageItem(previewItem) && (
                <button
                  onClick={() => {
                    handleViewImageClick(previewItem);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                  title={t('preview.viewFullscreen', '全屏查看')}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{t('preview.viewFullscreen', '全屏查看')}</span>
                </button>
              )}
              {previewItem.type === 'text' ? (
                <button
                  onClick={() => {
                    handleCopyClick(previewItem);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition"
                >
                  {t('records.copyAll')}
                </button>
              ) : previewItem.type === 'batch' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleViewBatchClick(previewItem);
                      setPreviewItem(null);
                    }}
                    className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('records.view', '查看合辑')}</span>
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadClick(previewItem);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('records.downloadZipAll', '打包下载全部 (.zip)')}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleDownloadClick(previewItem);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition"
                >
                  {t('records.downloadFile')}
                </button>
              )}
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition"
              >
                {t('records.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 密码验证弹窗 */}
      <PasswordModal
        isOpen={pwdModalState.isOpen}
        onClose={() => setPwdModalState({ isOpen: false, item: null, actionType: 'copy' })}
        title={pwdModalState.item?.title || ''}
        actionType={pwdModalState.actionType}
        onConfirm={handlePasswordConfirm}
      />

      {/* 操作审计弹窗 */}
      <AuditLogModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
      />

      {/* 删除操作确认弹窗 */}
      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalState.onConfirm}
        title={deleteModalState.title}
        content={deleteModalState.content}
        subContent={deleteModalState.subContent}
        confirmText={deleteModalState.confirmText}
      />

      {/* 文件专属下载/查看二维码弹窗 */}
      <FileQrModal
        isOpen={Boolean(fileQrData)}
        onClose={() => setFileQrData(null)}
        item={fileQrData?.item || null}
        downloadUrl={fileQrData?.downloadUrl || ''}
        mode={fileQrData?.mode}
      />

      {/* 文本 Markdown 渲染大弹窗 */}
      {markdownModalItem && (
        <TextMarkdownModal
          item={markdownModalItem}
          isOpen={Boolean(markdownModalItem)}
          onClose={() => setMarkdownModalItem(null)}
        />
      )}

      {/* 密码分享与提取信息小弹窗 */}
      {shareModalItem && (
        <ShareInfoModal
          isOpen={Boolean(shareModalItem)}
          onClose={() => setShareModalItem(null)}
          item={shareModalItem}
          downloadUrl={getItemShareUrl(shareModalItem)}
          verifyPassword={verifyPassword}
          onCopyShareLink={onCopyShareLink}
          onPasswordVerified={(pwd) => {
            if (shareModalItem) {
              shareModalItem.password = pwd;
            }
          }}
        />
      )}

      {/* 增强型清空全部与指定时间删除弹窗 */}
      <ClearRecordsModal
        isOpen={clearRecordsModalOpen}
        onClose={() => setClearRecordsModalOpen(false)}
        records={records}
        onConfirm={async (opts) => {
          await onClearAll(opts);
        }}
      />

      {/* 图片全屏查看大弹窗 */}
      {imageViewerItem && (
        <ImageViewerModal
          isOpen={Boolean(imageViewerItem)}
          onClose={() => setImageViewerItem(null)}
          item={imageViewerItem.item}
          allImageItems={allImageItems}
          password={imageViewerItem.password}
          onDownload={onDownload}
          currentAccessUrl={currentAccessUrl}
        />
      )}

      {/* 批量多文件合辑大弹窗 */}
      {batchViewerItem && (
        <BatchViewerModal
          isOpen={Boolean(batchViewerItem)}
          onClose={() => setBatchViewerItem(null)}
          item={batchViewerItem.item}
          password={batchViewerItem.password}
          onDownloadBatch={onDownload}
          currentAccessUrl={currentAccessUrl}
          verifyPassword={verifyPassword}
        />
      )}
    </div>
  );
};
