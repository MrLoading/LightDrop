import React, { useState, useEffect } from 'react';
import {
  Settings,
  FolderCog,
  HardDrive,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FolderCheck,
  Save,
  Database,
  Languages,
  Bell,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { formatBytes } from '../utils/format';
import { getCurrentLanguageSetting, changeAppLanguage } from '../i18n';
import {
  isDesktopNotificationSupported,
  getDesktopNotificationPermission,
  isDesktopNotificationEnabled,
  setDesktopNotificationEnabled,
  requestDesktopNotificationPermission,
  sendDesktopNotification,
} from '../utils/desktopNotification';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const { t } = useTranslation();
  const { settings, loading, saving, saveSettings, validateDir } = useSettings();

  const [language, setLanguage] = useState<'zh-CN' | 'en-US' | 'auto'>(() => getCurrentLanguageSetting());
  const [storageDir, setStorageDir] = useState('');
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(1024);
  const [autoCleanupDays, setAutoCleanupDays] = useState(0);
  const [migrateData, setMigrateData] = useState(true);

  const [dirValidating, setDirValidating] = useState(false);
  const [dirStatus, setDirStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getDesktopNotificationPermission()
  );
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>(() =>
    isDesktopNotificationEnabled()
  );
  const desktopNotificationSupported = isDesktopNotificationSupported();

  useEffect(() => {
    if (isOpen) {
      setNotificationPermission(getDesktopNotificationPermission());
      setNotificationEnabled(isDesktopNotificationEnabled());
    }
  }, [isOpen]);

  const handleRequestPermission = async () => {
    const granted = await requestDesktopNotificationPermission();
    setNotificationPermission(getDesktopNotificationPermission());
    setNotificationEnabled(granted);
    if (granted) {
      sendDesktopNotification({
        title: t('settings.testNotificationTitle', 'LightDrop · 系统通知测试'),
        body: t('settings.testNotificationBody', '系统通知已正常连接！局域网收到新文件或下载完成时将自动在屏幕右上角提醒您。'),
        force: true,
      });
    }
  };

  const handleToggleNotification = (checked: boolean) => {
    setDesktopNotificationEnabled(checked);
    setNotificationEnabled(checked);
  };

  const handleTestNotification = () => {
    sendDesktopNotification({
      title: t('settings.testNotificationTitle', 'LightDrop · 系统通知测试'),
      body: t('settings.testNotificationBody', '系统通知已正常连接！局域网收到新文件或下载完成时将自动在屏幕右上角提醒您。'),
      force: true,
    });
  };

  useEffect(() => {
    if (settings) {
      setStorageDir(settings.storageDir || './data');
      setMaxFileSizeMB(settings.maxFileSizeMB ?? 1024);
      setAutoCleanupDays(settings.autoCleanupDays ?? 0);
    }
    if (isOpen) {
      setLanguage(getCurrentLanguageSetting());
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleTestDir = async () => {
    if (!storageDir.trim()) {
      setDirStatus({ ok: false, message: t('settings.emptyDir') });
      return;
    }
    try {
      setDirValidating(true);
      const res = await validateDir(storageDir);
      if (res.success) {
        setDirStatus({ ok: true, message: t('settings.dirValid', { path: res.absolutePath }) });
      } else {
        setDirStatus({ ok: false, message: res.error || t('settings.storageStatusError') });
      }
    } catch (e: any) {
      setDirStatus({ ok: false, message: e?.message || 'Error' });
    } finally {
      setDirValidating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaveMessage(null);
      changeAppLanguage(language);
      await saveSettings({
        storageDir: storageDir.trim(),
        maxFileSizeMB: Number(maxFileSizeMB),
        autoCleanupDays: Number(autoCleanupDays),
        migrateData,
      });

      setSaveMessage({ ok: true, text: t('settings.saveSuccess') });
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => {
        onClose();
        setSaveMessage(null);
      }, 1200);
    } catch (err: any) {
      setSaveMessage({ ok: false, text: err?.message || t('settings.saveFailed') });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{t('settings.title')}</h2>
              <p className="text-[11px] text-slate-400">{t('settings.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {saveMessage && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2 font-medium ${
                saveMessage.ok
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {saveMessage.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              {saveMessage.text}
            </div>
          )}

          {/* 界面语言配置 */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <label className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-600" />
              {t('settings.language')}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => {
                  const val = e.target.value as 'zh-CN' | 'en-US' | 'auto';
                  setLanguage(val);
                  changeAppLanguage(val);
                }}
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 w-full"
              >
                <option value="zh-CN">{t('settings.langZh')}</option>
                <option value="en-US">{t('settings.langEn')}</option>
                <option value="auto">{t('settings.langAuto')}</option>
              </select>
            </div>
            <div className="text-[11px] text-slate-400">
              {t('settings.languageDesc')}
            </div>
          </div>

          {/* 系统桌面通知配置 */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-blue-600" />
                {t('settings.desktopNotificationTitle', '系统桌面消息通知')}
              </label>
              {desktopNotificationSupported && notificationPermission === 'granted' && (
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 text-[11px] transition cursor-pointer"
                >
                  {t('settings.sendTestNotification', '发送测试通知')}
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed">
              {t(
                'settings.desktopNotificationDesc',
                '当接收到局域网新文件或文件下载完成时，在电脑桌面（macOS / Windows）弹出原生横幅，点击可直接激活页面。'
              )}
            </div>

            {/* 权限与开关状态 */}
            {!desktopNotificationSupported ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-lg text-[11px] text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  {t(
                    'settings.desktopNotificationUnsupported',
                    '当前浏览器或非 HTTPS 局域网环境未开放系统通知接口，系统将自动使用页面顶部居中通知降级。'
                  )}
                </span>
              </div>
            ) : notificationPermission === 'denied' ? (
              <div className="p-2.5 bg-rose-50 border border-rose-200/80 rounded-lg text-[11px] text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>
                  {t(
                    'settings.desktopNotificationDenied',
                    '系统通知已被浏览器拒绝。请在浏览器地址栏左侧网站设置中开启「通知」权限。'
                  )}
                </span>
              </div>
            ) : notificationPermission === 'default' ? (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  {t('settings.desktopNotificationUnprompted', '尚未授予系统通知权限')}
                </span>
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer active:scale-95"
                >
                  {t('settings.enableDesktopNotification', '开启系统通知')}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-slate-700 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationEnabled}
                    onChange={(e) => handleToggleNotification(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">
                    {t('settings.desktopNotificationEnabledLabel', '启用系统桌面横幅通知')}
                  </span>
                </label>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('settings.permissionGranted', '已授权')}
                </span>
              </div>
            )}
          </div>

          {/* 存储目录配置 */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <FolderCog className="w-3.5 h-3.5 text-blue-600" />
                {t('settings.storageDir')}
              </label>
              <button
                type="button"
                onClick={handleTestDir}
                disabled={dirValidating}
                className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 text-[11px] transition"
              >
                {dirValidating ? t('settings.testing') : t('settings.testDir')}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={storageDir}
                onChange={(e) => {
                  setStorageDir(e.target.value);
                  setDirStatus(null);
                }}
                placeholder={t('settings.dirPlaceholder')}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {dirStatus && (
              <div
                className={`text-[11px] flex items-center gap-1 ${
                  dirStatus.ok ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {dirStatus.ok ? <FolderCheck className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {dirStatus.message}
              </div>
            )}

            <div className="text-[11px] text-slate-400 leading-relaxed">
              {t('settings.storageTip')}
            </div>

            {/* 数据迁移选项 */}
            <label className="flex items-center gap-2 pt-1 text-slate-600 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={migrateData}
                onChange={(e) => setMigrateData(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium">{t('settings.migrateData')}</span>
            </label>
          </div>

          {/* 存储空间状态 */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-500" />
              <div>
                <div className="font-semibold text-slate-700">{t('settings.storageUsage')}</div>
                <div className="text-[11px] text-slate-400">
                  {t('settings.status')}: {settings.isWritable ? t('settings.storageStatusOk') : t('settings.storageStatusError')}
                </div>
              </div>
            </div>
            <div className="text-sm font-bold text-slate-800">
              {formatBytes(settings.storageSizeBytes || 0)}
            </div>
          </div>

          {/* 单文件上传限制 */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <label className="font-semibold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              {t('settings.maxFileSize')}
            </label>
            <div className="flex items-center gap-2">
              <select
                value={maxFileSizeMB}
                onChange={(e) => setMaxFileSizeMB(Number(e.target.value))}
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 w-full"
              >
                <option value={100}>100 MB</option>
                <option value={500}>500 MB</option>
                <option value={1024}>1024 MB (1 GB)</option>
                <option value={2048}>2048 MB (2 GB)</option>
                <option value={5120}>5120 MB (5 GB)</option>
                <option value={0}>{t('settings.noLimit')}</option>
              </select>
            </div>
          </div>

          {/* 自动清理策略 */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
            <label className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              {t('settings.autoCleanup')}
            </label>
            <select
              value={autoCleanupDays}
              onChange={(e) => setAutoCleanupDays(Number(e.target.value))}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 w-full"
            >
              <option value={0}>{t('settings.neverCleanup')}</option>
              <option value={1}>{t('settings.cleanupDays_1')}</option>
              <option value={3}>{t('settings.cleanupDays_3')}</option>
              <option value={7}>{t('settings.cleanupDays_7')}</option>
              <option value={30}>{t('settings.cleanupDays_30')}</option>
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition"
          >
            {t('settings.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
