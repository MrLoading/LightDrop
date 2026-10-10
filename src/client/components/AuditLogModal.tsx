import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Trash2,
  X,
  RotateCw,
  Laptop,
  Clock,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AuditLogItem, AuditLogResponse } from '@shared/types';
import { formatDisplayTime } from '../utils/format';
import { getCharacterInfo, getDisplayNickname } from '../utils/nickname';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLocalHost, setIsLocalHost] = useState(false);
  const [clientIp, setClientIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit-logs');
      const json = await res.json();
      if (json.success && json.data) {
        setLogs(json.data.logs || []);
        setIsLocalHost(Boolean(json.data.isLocalHost));
        setClientIp(json.data.clientIp || '');
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setShowConfirmClear(false);
      fetchAuditLogs();
    }
  }, [isOpen]);

  const handleClearLogs = async () => {
    try {
      setClearing(true);
      const res = await fetch('/api/audit-logs/clear', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setLogs([]);
        setShowConfirmClear(false);
      } else {
        alert(json.error || t('audit.clearFailed'));
      }
    } catch (err: any) {
      alert(err?.message || t('audit.clearFailed'));
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  // 获取操作类型的徽章样式
  const getActionBadge = (action: string, label: string) => {
    switch (action) {
      case 'create_text':
      case 'upload_file':
      case 'upload_image':
      case 'upload_folder':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {label}
          </span>
        );
      case 'download_file':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {label}
          </span>
        );
      case 'copy_text':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
            {label}
          </span>
        );
      case 'copy_share_link':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            {label}
          </span>
        );
      case 'open_share_page':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
            {label}
          </span>
        );
      case 'verify_password':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            {label}
          </span>
        );
      case 'delete_record':
      case 'batch_delete':
      case 'clear_records':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {label}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 animate-fade-in overflow-hidden">
        {/* 顶部标题栏与操作按钮 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">{t('audit.title')}</h3>
                <span className="text-[11px] font-mono text-slate-400">
                  {t('audit.count', { count: logs.length })}
                </span>
                {isLocalHost && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                    {t('audit.hostBadge')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('audit.desc')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 刷新日志 */}
            <button
              onClick={fetchAuditLogs}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-50 border border-slate-200 transition"
              title={t('audit.refresh')}
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* 仅在“服务启动所在设备”上访问时，顶部显示【清空操作记录】按钮 */}
            {isLocalHost && (
              <>
                {!showConfirmClear ? (
                  <button
                    onClick={() => setShowConfirmClear(true)}
                    disabled={logs.length === 0 || clearing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={t('audit.clearBtn')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('audit.clearBtn')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 animate-fade-in">
                    <button
                      onClick={handleClearLogs}
                      disabled={clearing}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition active:scale-95 shadow-sm"
                    >
                      {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>{t('audit.confirmClearBtn')}</span>
                    </button>
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      disabled={clearing}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition"
                    >
                      {t('audit.cancel')}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title={t('audit.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 提示栏：若为非本机设备访问，展示提示 */}
        {!isLocalHost && (
          <div className="bg-amber-50/70 border-b border-amber-200/60 px-6 py-2 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                {t('audit.clientIpNotice', { ip: clientIp || t('audit.guestVisitor') })}
              </span>
            </div>
          </div>
        )}

        {/* 表格数据列表区域 */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 custom-scrollbar">
          {loading && logs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
              <span className="text-xs">{t('audit.clearing')}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-2.5">
                <CheckCircle2 className="w-6 h-6 text-slate-300" />
              </div>
              <span className="text-sm font-medium text-slate-600">{t('audit.emptyLogs')}</span>
              <span className="text-xs text-slate-400 mt-1">
                {t('audit.emptySub')}
              </span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-medium text-slate-400 select-none whitespace-nowrap">
                  <th className="py-2.5 px-3 w-32 shrink-0">
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {t('audit.thUser', '操作人')}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 w-36 shrink-0">
                    <div className="flex items-center gap-1">
                      <Laptop className="w-3.5 h-3.5 text-slate-400" />
                      {t('audit.thIp')}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 w-36 shrink-0">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {t('audit.thTime')}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 min-w-[200px]">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      {t('audit.thTarget')}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 w-32 shrink-0 text-right">{t('audit.thAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    {/* 操作人 (昵称) */}
                    <td className="py-3 px-3 whitespace-nowrap shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/60 max-w-[120px] truncate" title={getDisplayNickname(item.nickname, i18n.language)}>
                        <span className="text-xs leading-none shrink-0">{getCharacterInfo(item.nickname).emoji}</span>
                        <span className="truncate">{getDisplayNickname(item.nickname, i18n.language)}</span>
                      </span>
                    </td>

                    {/* 操作者 IP */}
                    <td className="py-3 px-3 whitespace-nowrap shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {item.ip}
                        </span>
                        {(item.ip === '127.0.0.1' || item.ip === '::1') && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-500">
                            {t('audit.localHostBadge')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 操作时间 */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px] shrink-0">
                      {formatDisplayTime(item.time)}
                    </td>

                    {/* 操作的记录 */}
                    <td className="py-3 px-3 min-w-0">
                      <div
                        className="font-medium text-slate-800 truncate max-w-[280px] sm:max-w-[360px]"
                        title={item.targetTitle}
                      >
                        {item.targetTitle}
                      </div>
                      {item.details && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {item.details}
                        </div>
                      )}
                    </td>

                    {/* 什么操作 */}
                    <td className="py-3 px-3 text-right whitespace-nowrap shrink-0">
                      {getActionBadge(item.action, item.actionLabel)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 底部关闭栏 */}
        <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {t('audit.storageNotice')}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium shadow-xs transition"
          >
            {t('audit.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
