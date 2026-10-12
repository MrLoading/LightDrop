import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actionType: 'copy' | 'download' | 'preview' | 'view_markdown' | 'view_image' | 'view_batch';
  onConfirm: (password: string) => Promise<boolean | void>;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  title,
  actionType,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMsg(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg(t('passwordModal.emptyError'));
      inputRef.current?.focus();
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      await onConfirm(password.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || t('passwordModal.incorrectError'));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  const actionVerb =
    actionType === 'copy'
      ? t('passwordModal.actionCopy')
      : actionType === 'download'
      ? t('passwordModal.actionDownload')
      : actionType === 'view_markdown'
      ? t('passwordModal.actionViewMarkdown')
      : actionType === 'view_image'
      ? t('passwordModal.actionViewImage')
      : actionType === 'view_batch'
      ? t('records.view', '查看')
      : t('passwordModal.actionUnlock');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-fade-in flex flex-col">
        {/* 图标与头部 */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">{t('passwordModal.title')}</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-[260px] truncate" title={title}>
            「{title}」
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t('passwordModal.desc', { action: actionVerb })}
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              data-lpignore="true"
              data-1p-ignore="true"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={t('passwordModal.inputPlaceholder')}
              className={`w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl font-mono text-slate-800 transition focus:outline-none ${
                errorMsg
                  ? 'border-2 border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-400'
                  : 'bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              title={showPassword ? t('passwordModal.hide') : t('passwordModal.show')}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* 密码错误提示栏 */}
          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg animate-fade-in font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/2 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition"
            >
              {t('passwordModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-1/2 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('passwordModal.verifying')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('passwordModal.confirm', { action: actionVerb })}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
