import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  File,
  FolderArchive,
  Image as ImageIcon,
  FileCode,
  Download,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Calendar,
  HardDrive,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem } from '@shared/types';
import { formatBytes, formatDisplayTime, getFileTypeLabel } from '../utils/format';
import { copyToClipboard } from '../utils/clipboard';
import { TextReaderView } from './TextReaderView';
import { getUserNickname, getCharacterInfo } from '../utils/nickname';

interface DownloadPasswordPageProps {
  recordId: string;
  onBack?: () => void;
}

export const DownloadPasswordPage: React.FC<DownloadPasswordPageProps> = ({
  recordId,
  onBack,
}) => {
  const { t } = useTranslation();
  const [record, setRecord] = useState<ShareItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockedContent, setUnlockedContent] = useState<string>('');
  const [downloadTriggered, setDownloadTriggered] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // 加载单条记录信息
  const fetchRecord = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch(`/api/records/${recordId}`);
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || '记录不存在或已被清理');
      }
      setRecord(json.data);
    } catch (err: any) {
      setLoadError(err?.message || '获取文件信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
    // 审计记录：打开分享/下载提取页面
    try {
      const visitorNickname = getUserNickname();
      fetch(`/api/records/${recordId}/open-page`, {
        method: 'POST',
        headers: { 'x-user-nickname': encodeURIComponent(visitorNickname) },
      }).catch(() => {});
    } catch (_) {}
  }, [recordId]);

  // 触发实际文件下载 (携带访问密码与访客昵称)
  const triggerFileDownload = (pwd?: string) => {
    const visitorNickname = getUserNickname();
    const params = new URLSearchParams();
    if (pwd) params.set('password', pwd);
    if (visitorNickname) params.set('nickname', visitorNickname);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const downloadUrl = `/api/records/${recordId}/download${queryString}`;
    setDownloadTriggered(true);
    window.location.href = downloadUrl;
  };

  const doVerifyPassword = async (pwdToVerify: string) => {
    if (!pwdToVerify.trim()) return false;
    try {
      setVerifying(true);
      setVerifyError(null);

      const visitorNickname = getUserNickname();
      const res = await fetch(`/api/records/${recordId}/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-nickname': encodeURIComponent(visitorNickname),
        },
        body: JSON.stringify({ password: pwdToVerify.trim() }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || t('passwordModal.incorrectError', '密码错误，请重新输入'));
      }

      // 验证通过，记录至 sessionStorage 避免刷新丢失
      try {
        sessionStorage.setItem(`lightdrop_pwd_${recordId}`, pwdToVerify.trim());
      } catch (_) {}

      setIsUnlocked(true);

      if (record?.type === 'text') {
        setUnlockedContent(json.content || '');
      } else {
        // 自动触发文件下载
        triggerFileDownload(pwdToVerify.trim());
      }
      return true;
    } catch (err: any) {
      setVerifyError(err?.message || t('passwordModal.incorrectError', '密码错误，请重新输入'));
      passwordInputRef.current?.select();
      return false;
    } finally {
      setVerifying(false);
    }
  };

  // 当文件加载完成且需要密码时：优先从 URL 或 sessionStorage 尝试自动解锁
  useEffect(() => {
    if (!loading && record?.hasPassword && !isUnlocked) {
      const queryParams = new URLSearchParams(window.location.search);
      const urlPwd = queryParams.get('pwd') || queryParams.get('password');
      let cachedPwd = '';
      try {
        cachedPwd = sessionStorage.getItem(`lightdrop_pwd_${recordId}`) || '';
      } catch (_) {}

      const autoPwd = urlPwd || cachedPwd;
      if (autoPwd) {
        setPassword(autoPwd);
        doVerifyPassword(autoPwd);
        return;
      }

      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [loading, record?.hasPassword, isUnlocked]);

  // 提交密码验证表单
  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setVerifyError(t('passwordModal.emptyError', '请输入访问密码'));
      passwordInputRef.current?.focus();
      return;
    }

    await doVerifyPassword(password.trim());
  };

  // 获取文件展示图标
  const getRecordIcon = () => {
    if (!record) return null;
    if (record.type === 'text') {
      return (
        <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 shadow-sm border border-sky-200/50">
          <FileText className="w-7 h-7" />
        </div>
      );
    }
    if (record.type === 'image') {
      return (
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm border border-emerald-200/50">
          <ImageIcon className="w-7 h-7" />
        </div>
      );
    }
    if (record.type === 'folder') {
      return (
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-sm border border-amber-200/50">
          <FolderArchive className="w-7 h-7" />
        </div>
      );
    }

    const ext = (record.extension || '').toLowerCase();
    if (['ts', 'js', 'py', 'java', 'html', 'json'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-200/50">
          <FileCode className="w-7 h-7" />
        </div>
      );
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return (
        <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 shadow-sm border border-purple-200/50">
          <FolderArchive className="w-7 h-7" />
        </div>
      );
    }

    return (
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm border border-indigo-200/50">
        <File className="w-7 h-7" />
      </div>
    );
  };

  const handleGoHome = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/';
    }
  };

  // 场景 A: 文本类型且已解锁 (或无需密码) -> 渲染统一的 Markdown 阅读界面
  if (record && record.type === 'text' && (!record.hasPassword || isUnlocked)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-[#f0f4f9] animate-fade-in">
        <div className="bg-white rounded-2xl w-full max-w-4xl lg:max-w-5xl shadow-2xl border border-slate-200/90 flex flex-col h-[94vh] sm:h-[85vh] overflow-hidden animate-scale-in">
          <TextReaderView
            item={record}
            customContent={unlockedContent || record.content}
            onClose={handleGoHome}
            isStandalone
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* 顶部导航 */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between pb-6">
        <button
          onClick={handleGoHome}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-slate-700 hover:text-blue-600 hover:border-blue-200 shadow-2xs text-xs font-medium transition active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('header.goHome', '返回 LightDrop 首页')}</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            LD
          </div>
          <span className="font-bold text-slate-800 text-sm tracking-tight">LightDrop 快传</span>
        </div>
      </header>

      {/* 主体卡片容器 */}
      <main className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-xs text-slate-500 font-medium">{t('records.loading', '正在加载文件信息...')}</p>
          </div>
        ) : loadError || !record ? (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 flex flex-col items-center text-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4 border border-rose-100">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">{t('downloadPage.notFoundTitle', '记录不存在或已被清理')}</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-xs">
              {loadError || t('downloadPage.notFoundDesc', '该文件可能已被发送者删除，或已超过系统自动保留时效。')}
            </p>
            <button
              onClick={handleGoHome}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition active:scale-98"
            >
              {t('downloadPage.backHome', '返回首页')}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col animate-fade-in">
            {/* 顶部图标与标题 */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mb-3">{getRecordIcon()}</div>
              <h2
                className="text-base font-bold text-slate-900 break-all line-clamp-2 max-w-sm"
                title={record.fileName || record.title}
              >
                {record.fileName || record.title}
              </h2>

              {/* 标签徽章 */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
                  <span className="text-xs leading-none">{getCharacterInfo(record.senderName || record.nickname).emoji}</span>
                  <span>{t('downloadPage.sharedBy', '由 {{name}} 分享', { name: record.senderName || record.nickname || '海绵宝宝' })}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                  <HardDrive className="w-3 h-3 text-slate-400" />
                  {formatBytes(record.fileSize)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {formatDisplayTime(record.createdAt)}
                </span>
                {record.hasPassword && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>{t('records.pwdProtected', '密码保护')}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 文件基本信息汇总 */}
            <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70 mb-5 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('downloadPage.sharer', '分享人')}</span>
                <span className="font-medium text-slate-800 flex items-center gap-1">
                  <span>{getCharacterInfo(record.senderName || record.nickname).emoji}</span>
                  <span>{record.senderName || record.nickname || '海绵宝宝'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('records.thType', '文件类型')}</span>
                <span className="font-medium text-slate-700">
                  {record.type === 'folder'
                    ? `文件夹 (${record.fileCount || 0} 个文件)`
                    : record.type === 'text'
                    ? '纯文本'
                    : getFileTypeLabel(record.fileName, record.extension)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('records.thSize', '文件大小')}</span>
                <span className="font-medium text-slate-700">{formatBytes(record.fileSize)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('records.thTime', '创建时间')}</span>
                <span className="font-medium text-slate-700">{formatDisplayTime(record.createdAt)}</span>
              </div>
            </div>

            {/* 场景 1: 无密码保护 - 直接下载 */}
            {!record.hasPassword && (
              <div className="space-y-3">
                <button
                  onClick={() => triggerFileDownload()}
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-200 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('records.download', '立即下载文件')}</span>
                </button>
              </div>
            )}

            {/* 场景 2: 有密码保护且已成功解锁 (文件/图片/文件夹) */}
            {record.hasPassword && isUnlocked && (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">{t('downloadPage.unlockSuccess', '密码验证成功！')}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      {downloadTriggered
                        ? t('downloadPage.downloadTriggered', '文件正在下载中，请留意浏览器下载提示')
                        : t('downloadPage.readyToDownload', '文件已准备就绪，可随时下载')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => triggerFileDownload(password)}
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-200 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('downloadPage.reDownload', '重新下载文件')}</span>
                </button>
              </div>
            )}

            {/* 场景 3: 有密码保护且待输入验证 */}
            {record.hasPassword && !isUnlocked && (
              <form onSubmit={handleSubmitPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    {record.type === 'text'
                      ? t('downloadPage.inputTextLabel', '请输入访问密码以解锁阅读')
                      : t('downloadPage.inputLabel', '请输入访问密码以提取文件')}
                  </label>

                  <div className="relative">
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="off"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setVerifyError(null);
                      }}
                      placeholder={t('passwordModal.inputPlaceholder', '输入访问密码...')}
                      className={`w-full px-3.5 py-2.5 pr-10 rounded-xl text-xs font-mono border transition outline-none ${
                        verifyError
                          ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-200 animate-shake'
                          : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded transition"
                      title={showPassword ? t('passwordModal.hide') : t('passwordModal.show')}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* 错误提示 (如果验证失败，醒目提示并要求重试) */}
                  {verifyError && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium animate-fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{verifyError}</span>
                    </div>
                  )}
                </div>

                {/* 提交按钮 */}
                <button
                  type="submit"
                  disabled={verifying || !password.trim()}
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs shadow-md shadow-blue-200 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('passwordModal.verifying', '正在校验密码...')}</span>
                    </>
                  ) : record.type === 'text' ? (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>{t('downloadPage.submitUnlockText', '验证密码并开始阅读')}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{t('downloadPage.submitVerify', '验证并下载文件')}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </main>

      {/* 底部版权 */}
      <footer className="max-w-4xl mx-auto w-full text-center pt-6 text-[11px] text-slate-400">
        LightDrop · 极速局域网跨设备文件传输与共享服务
      </footer>
    </div>
  );
};
