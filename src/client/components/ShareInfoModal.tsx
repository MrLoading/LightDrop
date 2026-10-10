import React, { useState } from 'react';
import {
  FileText,
  File,
  FolderArchive,
  Image as ImageIcon,
  Copy,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  ExternalLink,
  Calendar,
  HardDrive,
  Share2,
  KeyRound,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem } from '@shared/types';
import { formatBytes, formatDisplayTime, getFileTypeLabel } from '../utils/format';
import { copyToClipboard } from '../utils/clipboard';
import { getCharacterInfo } from '../utils/nickname';

interface ShareInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShareItem | null;
  downloadUrl: string;
  verifyPassword?: (id: string, password: string) => Promise<string>;
  onPasswordVerified?: (password: string) => void;
  onCopyShareLink?: (id: string) => void;
}

export const ShareInfoModal: React.FC<ShareInfoModalProps> = ({
  isOpen,
  onClose,
  item,
  downloadUrl,
  verifyPassword,
  onPasswordVerified,
  onCopyShareLink,
}) => {
  const { t } = useTranslation();
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // 针对历史记录未存明文密码时的动态输入验证
  const [inputPwd, setInputPwd] = useState('');
  const [verifiedPwd, setVerifiedPwd] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // 复制免密直链状态
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);

  if (!isOpen || !item) return null;

  const currentPassword = item.password || verifiedPwd || '';
  const directUnlockedUrl = currentPassword
    ? `${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}pwd=${encodeURIComponent(currentPassword)}`
    : '';

  // 复制免密直链
  const handleCopyDirectLink = async () => {
    if (!directUnlockedUrl) return;
    const ok = await copyToClipboard(directUnlockedUrl);
    if (ok) {
      setCopiedDirectLink(true);
      setTimeout(() => setCopiedDirectLink(false), 2000);
      onCopyShareLink?.(item.id);
    }
  };

  // 获取文件展示图标
  const getItemIcon = () => {
    if (item.type === 'text') {
      return (
        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (item.type === 'image') {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
          <ImageIcon className="w-5 h-5" />
        </div>
      );
    }
    if (item.type === 'folder') {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
          <FolderArchive className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
        <File className="w-5 h-5" />
      </div>
    );
  };

  // 复制下载链接
  const handleCopyLinkOnly = async () => {
    const ok = await copyToClipboard(downloadUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      onCopyShareLink?.(item.id);
    }
  };

  // 复制访问密码
  const handleCopyPwdOnly = async () => {
    if (!currentPassword) return;
    const ok = await copyToClipboard(currentPassword);
    if (ok) {
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
      onCopyShareLink?.(item.id);
    }
  };

  // 一键复制全部信息 (格式化分享文本，包含分享者信息)
  const handleCopyAllInfo = async () => {
    const sender = item.senderName || item.nickname || '海绵宝宝';
    const fileName = item.fileName || item.title || '文件';
    const fileSize = formatBytes(item.fileSize);
    const createdAt = formatDisplayTime(item.createdAt);
    const pwdText = currentPassword ? currentPassword : '已加密保护 (需访问密码)';

    const isText = item.type === 'text';
    const headerTitle = isText ? '【LightDrop 文本分享】' : '【LightDrop 文件分享】';
    const labelName = isText ? '文本内容：' : '文件名：';
    const labelLink = isText ? '查看链接：' : '下载链接：';
    const labelPwd = isText ? '访问密码：' : '提取密码：';

    const textToCopy = [
      headerTitle,
      `分享人：${sender}`,
      `${labelName}${fileName}`,
      `文件大小：${fileSize}`,
      `创建时间：${createdAt}`,
      `${labelLink}${downloadUrl}`,
      `${labelPwd}${pwdText}`,
      ...(directUnlockedUrl ? [`免密直达：${directUnlockedUrl}`] : []),
    ].join('\n');

    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
      onCopyShareLink?.(item.id);
    }
  };

  // 校验补填历史密码
  const handleVerifyLegacyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPwd.trim() || !verifyPassword) return;

    try {
      setVerifying(true);
      setVerifyError(null);
      await verifyPassword(item.id, inputPwd.trim());
      setVerifiedPwd(inputPwd.trim());
      if (onPasswordVerified) {
        onPasswordVerified(inputPwd.trim());
      }
      setInputPwd('');
    } catch (err: any) {
      setVerifyError(err?.message || '密码错误，请重新输入');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-fade-in relative flex flex-col">
        {/* 顶部关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 弹窗标题 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {item.type === 'text' ? t('shareModal.titleText', '文本分享提取信息') : t('shareModal.title', '文件分享提取信息')}
            </h3>
            <p className="text-[11px] text-slate-400">
              {t('shareModal.subtitle', '此内容已开启访问密码保护，可复制以下提取信息发送给他人')}
            </p>
          </div>
        </div>

        {/* 文件基本信息卡片 */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 flex items-start gap-3">
          {getItemIcon()}
          <div className="flex-1 min-w-0">
            <h4
              className="text-xs font-bold text-slate-800 truncate"
              title={item.fileName || item.title}
            >
              {item.fileName || item.title}
            </h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200/60 shadow-2xs">
                <span className="text-xs leading-none">{getCharacterInfo(item.senderName || item.nickname).emoji}</span>
                <span>{item.senderName || item.nickname || '海绵宝宝'}</span>
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-slate-400 shrink-0" />
                {formatBytes(item.fileSize)}
                {item.type === 'folder' && ` (${item.fileCount || 0} 个文件)`}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                {formatDisplayTime(item.createdAt)}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              {item.type === 'folder'
                ? '文件夹'
                : item.type === 'text'
                ? '纯文本'
                : getFileTypeLabel(item.fileName, item.extension)}
            </div>
          </div>
        </div>

        {/* 信息详情列表 */}
        <div className="space-y-3 mb-5 text-xs">
          {/* 下载/查看链接 */}
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1 text-[11px] font-medium">
              <span>{item.type === 'text' ? t('shareModal.linkText', '查看链接') : t('shareModal.link', '下载链接')}</span>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-0.5 text-[10px]"
              >
                <span>{t('shareModal.openInNewTab', '打开测试')}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="flex items-center gap-1.5 p-2 bg-slate-100/80 rounded-xl border border-slate-200/70 font-mono text-[11px] text-slate-700">
              <span className="truncate flex-1 text-left select-all" title={downloadUrl}>
                {downloadUrl}
              </span>
              <button
                onClick={handleCopyLinkOnly}
                className={`px-2 py-1 rounded-lg border text-[11px] font-sans font-medium transition active:scale-95 flex items-center gap-1 shrink-0 ${
                  copiedLink
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 border-slate-200'
                }`}
                title={t('shareModal.copyLink', '复制下载链接')}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>{t('records.copied', '已复制')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>{t('shareModal.copy', '复制')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 访问密码 */}
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1 text-[11px] font-medium">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>{t('shareModal.password', '提取密码')}</span>
              </span>
            </div>

            {currentPassword ? (
              <div className="flex items-center gap-1.5 p-2 bg-amber-50/60 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 font-mono">
                <div className="flex-1 flex items-center gap-1.5 truncate">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-bold select-all tracking-wider text-xs">
                    {showPwd ? currentPassword : '••••••••'}
                  </span>
                </div>

                {/* 显示/隐藏密码开关 */}
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  className="p-1 text-amber-700 hover:text-amber-900 rounded transition"
                  title={showPwd ? '隐藏密码' : '显示密码'}
                >
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={handleCopyPwdOnly}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-sans font-medium transition active:scale-95 flex items-center gap-1 shrink-0 ${
                    copiedPwd
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-white text-amber-800 hover:text-amber-900 hover:border-amber-300 border-amber-200'
                  }`}
                  title={t('shareModal.copyPwd', '复制密码')}
                >
                  {copiedPwd ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>{t('records.copied', '已复制')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t('shareModal.copy', '复制')}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyLegacyPassword} className="space-y-1.5">
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                  <input
                    type="password"
                    value={inputPwd}
                    onChange={(e) => {
                      setInputPwd(e.target.value);
                      setVerifyError(null);
                    }}
                    placeholder={t('shareModal.legacyInputPlaceholder', '历史记录未保存明文，输入验证后可显示')}
                    className="flex-1 bg-transparent px-2 py-1 text-[11px] outline-none text-slate-800 placeholder:text-slate-400 font-sans"
                  />
                  <button
                    type="submit"
                    disabled={verifying || !inputPwd.trim()}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-medium transition shrink-0 flex items-center gap-1"
                  >
                    {verifying && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{t('shareModal.verify', '验证')}</span>
                  </button>
                </div>
                {verifyError && (
                  <div className="flex items-center gap-1 text-[11px] text-rose-500">
                    <AlertCircle className="w-3 h-3" />
                    <span>{verifyError}</span>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* 快捷免密直链 (如果有密码，提供直接带参数秒开链接) */}
          {directUnlockedUrl && (
            <div>
              <div className="flex items-center justify-between text-slate-500 mb-1 text-[11px] font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{t('shareModal.directLink', '快捷免密链接')}</span>
                </span>
                <span className="text-[10px] text-slate-400">点开直接免输入密码阅读</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 bg-emerald-50/50 rounded-xl border border-emerald-200/60 font-mono text-[11px] text-slate-700">
                <span className="truncate flex-1 text-left select-all" title={directUnlockedUrl}>
                  {directUnlockedUrl}
                </span>
                <button
                  onClick={handleCopyDirectLink}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-sans font-medium transition active:scale-95 flex items-center gap-1 shrink-0 ${
                    copiedDirectLink
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-emerald-700 hover:text-emerald-800 hover:border-emerald-300 border-emerald-200'
                  }`}
                  title={t('shareModal.copyDirectLink', '复制免密链接')}
                >
                  {copiedDirectLink ? (
                    <>
                      <Check className="w-3 h-3 text-white" />
                      <span>{t('records.copied', '已复制')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{t('shareModal.copy', '复制')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        <div className="flex flex-col gap-2">
          {/* 一键复制全部信息 */}
          <button
            onClick={handleCopyAllInfo}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold shadow-sm transition active:scale-98 flex items-center justify-center gap-1.5 ${
              copiedAll
                ? 'bg-emerald-600 text-white shadow-emerald-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
            }`}
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4" />
                <span>{t('shareModal.copiedAll', '已复制全部信息 (链接与密码)')}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{t('shareModal.copyAll', '一键复制全部信息 (包含链接与密码)')}</span>
              </>
            )}
          </button>

          {/* 关闭 */}
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-600 rounded-xl text-xs font-medium transition"
          >
            {t('shareModal.close', '完成并关闭')}
          </button>
        </div>
      </div>
    </div>
  );
};
