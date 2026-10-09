import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  content: string;
  subContent?: string;
  confirmText?: string;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  content,
  subContent,
  confirmText,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-fade-in flex flex-col items-center text-center relative">
        {/* 右上角关闭叉号 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title={t('records.close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* 危险警告图标 */}
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center mb-3.5 shadow-inner">
          <Trash2 className="w-6 h-6 text-rose-600" />
        </div>

        {/* 标题 */}
        <h3 className="text-base font-bold text-slate-800">{title}</h3>

        {/* 描述内容 */}
        <p className="text-xs text-slate-600 mt-2 leading-relaxed px-2 break-all">
          {content}
        </p>

        {/* 警示次级说明 */}
        {subContent && (
          <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-800 flex items-center gap-1.5 text-left font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{subContent}</span>
          </div>
        )}

        {/* 底部按钮栏 */}
        <div className="flex items-center gap-2.5 w-full mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition active:scale-95"
          >
            {t('records.close')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold shadow-sm shadow-rose-500/25 transition"
          >
            {confirmText || t('records.delModalConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
