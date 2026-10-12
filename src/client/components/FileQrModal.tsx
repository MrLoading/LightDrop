import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  File,
  FolderArchive,
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
  X,
  Smartphone,
  Download,
  Wifi,
  Lock,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem } from '@shared/types';
import { formatBytes, isImageItem } from '../utils/format';
import { copyToClipboard } from '../utils/clipboard';

interface FileQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShareItem | null;
  downloadUrl: string;
  mode?: 'download' | 'view';
}

export const FileQrModal: React.FC<FileQrModalProps> = ({
  isOpen,
  onClose,
  item,
  downloadUrl,
  mode = 'download',
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !item) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(downloadUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isFolder = item.type === 'folder';
  const isText = item.type === 'text';
  const isImage = isImageItem(item);
  const isView = mode === 'view';

  const getTitle = () => {
    if (isView) {
      if (isText) return t('fileQrModal.titleTextView', '文本专属查看二维码');
      if (isImage) return t('fileQrModal.titleImageView', '图片专属查看二维码');
      return t('fileQrModal.titleFileView', '文件专属查看二维码');
    }
    return isText ? t('fileQrModal.titleText', '文本专属直链二维码') : t('fileQrModal.titleFile', '文件专属下载二维码');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-fade-in flex flex-col items-center text-center relative">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title={t('fileQrModal.close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* 顶部文件图标 */}
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center mb-3 shadow-inner">
          {isFolder ? (
            <FolderArchive className="w-6 h-6 text-amber-500" />
          ) : isText ? (
            <FileText className="w-6 h-6 text-sky-500" />
          ) : isImage ? (
            <ImageIcon className="w-6 h-6 text-emerald-500" />
          ) : (
            <File className="w-6 h-6 text-indigo-500" />
          )}
        </div>

        {/* 标题与文件名 */}
        <div className="flex items-center gap-1.5 justify-center">
          {isView ? (
            <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          )}
          <h3 className="text-sm font-bold text-slate-800">
            {getTitle()}
          </h3>
        </div>
        <p
          className="text-xs font-semibold text-slate-700 mt-1 max-w-[280px] truncate"
          title={item.title || item.fileName}
        >
          {item.fileName || item.title}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {formatBytes(item.fileSize)}
          {item.hasPassword && ` · ${t('fileQrModal.passwordProtected')}`}
        </p>

        {/* 动态二维码展示区 */}
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-inner my-3.5 flex flex-col items-center">
          <QRCodeSVG value={downloadUrl} size={170} level="M" />
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <Wifi className="w-3 h-3 text-sky-500" />
            {isView ? t('fileQrModal.scanTipView', '手机同一 Wi-Fi 下扫码直接查看详情与预览') : t('fileQrModal.scanTip')}
          </div>
        </div>

        {/* 密码提示 (如果有) */}
        {item.hasPassword && (
          <div className="w-full mb-3 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            <span>{t('fileQrModal.passwordTip')}</span>
          </div>
        )}

        {/* 下载直链显示框 */}
        <div className="w-full flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-mono text-slate-700 mb-4">
          <span className="truncate max-w-[220px] text-left">{downloadUrl}</span>
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition active:scale-95 flex items-center gap-1 text-[11px] font-sans shrink-0 ml-1.5 ${
              copied
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 border-slate-200'
            }`}
            title={t('fileQrModal.copyLink')}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span>{t('fileQrModal.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>{t('fileQrModal.copyLink')}</span>
              </>
            )}
          </button>
        </div>

        {/* 底部按钮 */}
        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
        >
          {t('fileQrModal.done')}
        </button>
      </div>
    </div>
  );
};
