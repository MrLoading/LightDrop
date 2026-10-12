import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  File,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  Info,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem } from '../../shared/types.js';
import { formatBytes } from '../utils/format';
import {
  SavedDirectoryInfo,
  DownloadDestinationType,
  isDirectoryPickerSupported,
  getSavedDownloadDirectory,
  setBrowserDefaultDownload,
  pickDownloadDirectory,
  getRecordDownloadFileName,
  buildDownloadUrl,
  saveFileToDirectoryHandle,
  triggerBrowserFallbackDownload,
} from '../utils/downloadManager';
import {
  getOperatingSystem,
  getOsDisplayName,
  getOsDownloadsFolderName,
} from '../utils/platform';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ShareItem | null;
  password?: string;
  onSuccess?: (dirName: string, fileName: string) => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  onClose,
  item,
  password,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const [selectedType, setSelectedType] = useState<DownloadDestinationType>('browser_default');
  const [directoryInfo, setDirectoryInfo] = useState<SavedDirectoryInfo>({
    type: 'browser_default',
    handle: null,
    dirName: null,
  });
  const [loadingDir, setLoadingDir] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; loaded: number; total: number }>({
    percent: 0,
    loaded: 0,
    total: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBlockedNotice, setShowBlockedNotice] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const isSupported = isDirectoryPickerSupported();
  const os = getOperatingSystem();
  const isMac = os === 'macos';
  const isEnglish = i18n?.language ? i18n.language.startsWith('en') : false;
  const osName = getOsDisplayName(os);
  const osFolder = getOsDownloadsFolderName(os, isEnglish);

  // 每次打开弹窗时，读取浏览器缓存的下载设置信息
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setShowBlockedNotice(false);
      setProgress({ percent: 0, loaded: 0, total: 0 });
      setDownloading(false);
      setLoadingDir(true);

      getSavedDownloadDirectory()
        .then((info) => {
          setDirectoryInfo(info);
          setSelectedType(info.type);
        })
        .finally(() => {
          setLoadingDir(false);
        });
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const fileName = getRecordDownloadFileName(item);
  const downloadUrl = buildDownloadUrl(item, password);

  // 切换为系统默认下载目录模式
  const handleSelectDefault = async () => {
    setSelectedType('browser_default');
    setErrorMessage(null);
    setShowBlockedNotice(false);
    await setBrowserDefaultDownload();
    setDirectoryInfo((prev) => ({ ...prev, type: 'browser_default' }));
  };

  // 切换为自定义目录模式
  const handleSelectCustom = () => {
    setSelectedType('custom_directory');
    setErrorMessage(null);
    if (!directoryInfo.handle) {
      handleChangeCustomDirectory();
    }
  };

  // 唤起系统目录选择器更改自定义目录
  const handleChangeCustomDirectory = async () => {
    setErrorMessage(null);
    setShowBlockedNotice(false);
    try {
      const newInfo = await pickDownloadDirectory();
      setDirectoryInfo(newInfo);
      setSelectedType('custom_directory');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setShowBlockedNotice(true);
      } else {
        setErrorMessage(err?.message || t('downloadModal.changeDirFailed', '选择目录失败'));
      }
    }
  };

  // 执行下载
  const handleStartDownload = async () => {
    setErrorMessage(null);
    setShowBlockedNotice(false);
    setDownloading(true);

    try {
      // 1. 若选择系统默认下载目录 (或当前环境不支持 File System Access API)
      if (selectedType === 'browser_default' || !isSupported) {
        await setBrowserDefaultDownload();
        triggerBrowserFallbackDownload(downloadUrl, fileName);
        if (onSuccess) {
          const defaultTitle = t('downloadModal.destDefaultTitle', {
            osFolder,
            defaultValue: `系统默认下载目录 (${osFolder})`,
          });
          onSuccess(defaultTitle, fileName);
        }
        onClose();
        return;
      }

      // 2. 自定义目录流式写入
      let activeHandle = directoryInfo.handle;
      let activeDirName = directoryInfo.dirName;

      // 若尚未选取自定义目录，本次先唤起选择
      if (!activeHandle) {
        try {
          const picked = await pickDownloadDirectory();
          activeHandle = picked.handle;
          activeDirName = picked.dirName;
          setDirectoryInfo(picked);
        } catch (pickErr: any) {
          if (pickErr?.name === 'AbortError') {
            setShowBlockedNotice(true);
            setDownloading(false);
            return;
          }
          throw pickErr;
        }
      }

      if (!activeHandle) {
        throw new Error(t('downloadModal.noDirChosen', '未指定本机目录'));
      }

      // 将文件直接流式写入到已选定的目标目录中
      await saveFileToDirectoryHandle(
        activeHandle,
        fileName,
        downloadUrl,
        (percent, loaded, total) => {
          setProgress({ percent, loaded, total });
        }
      );

      if (onSuccess) {
        onSuccess(activeDirName || '本地目录', fileName);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || t('downloadModal.downloadFailed', '下载失败'));
    } finally {
      setDownloading(false);
    }
  };

  const renderIcon = () => {
    if (item.type === 'folder' || item.type === 'batch') {
      return <FileArchive className="w-6 h-6 text-amber-500" />;
    }
    if (item.type === 'image') {
      return <ImageIcon className="w-6 h-6 text-indigo-500" />;
    }
    if (item.type === 'text') {
      return <FileText className="w-6 h-6 text-blue-500" />;
    }
    return <File className="w-6 h-6 text-slate-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {t('downloadModal.title', '下载文件')}
              </h3>
              <p className="text-[11px] text-slate-500">
                {t('downloadModal.subtitle', '选择或确认下载保存目录')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={downloading}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-5 space-y-4">
          {/* 文件信息卡片 */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="p-2 bg-white rounded-lg shadow-2xs border border-slate-200/60 shrink-0">
              {renderIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 truncate" title={fileName}>
                {fileName}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                <span>{formatBytes(item.fileSize)}</span>
                {(item.type === 'folder' || item.type === 'batch') && (
                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-700 text-[10px] rounded font-sans font-medium">
                    {t('downloadModal.folderZipBadge', '打包为 ZIP')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 保存目录选择区域 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                {t('downloadModal.saveDir', '本机保存目录')}
              </span>
              <span className="text-[10px] text-slate-400">
                {isSupported
                  ? t('downloadModal.firstChooseTip', '选择后将永久记住，可随时修改')
                  : t('downloadModal.managedDirTip', '当前由浏览器下载管理器自动处理')}
              </span>
            </div>

            {loadingDir ? (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('downloadModal.readingSavedDir', '正在读取浏览器已记住的目录...')}</span>
              </div>
            ) : !isSupported ? (
              /* 不支持 File System Access API 时的展示 (如局域网 HTTP 或不支持该特性的浏览器) */
              <div className="space-y-2.5">
                {/* 默认托管卡片 */}
                <div className="p-3.5 rounded-xl border border-blue-200/90 bg-blue-50/50 shadow-2xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100/90 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">
                        {t('downloadModal.destDefaultTitle', {
                          osFolder,
                          defaultValue: `系统默认下载目录 (${osFolder})`,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {t('downloadModal.browserManagedBadge', '浏览器托管 · 免授权')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      {t('downloadModal.browserManagedDesc', {
                        osName,
                        defaultValue: `文件将直接由浏览器保存至 ${osName}「下载」文件夹，免授权、最稳定快速。`,
                      })}
                    </p>
                  </div>
                </div>

                {/* 友好引导卡片：解释为什么无法在局域网网页直接选目录，并告诉用户如何在浏览器端实现自选目录 */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 space-y-2 text-[11px] transition">
                  <div
                    onClick={() => setShowGuide((prev) => !prev)}
                    className="flex items-center justify-between cursor-pointer select-none text-slate-700 hover:text-slate-900 transition"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>{t('downloadModal.customDirGuideTitle', '想要自由选择保存位置？')}</span>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium"
                    >
                      <span>
                        {showGuide
                          ? t('downloadModal.guideCollapse', '收起指引')
                          : t('downloadModal.guideExpand', '查看如何自选保存目录')}
                      </span>
                      {showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  <p className="text-slate-500 leading-relaxed">
                    {t(
                      'downloadModal.customDirGuideDesc',
                      '受浏览器安全机制限制，在局域网（HTTP）环境下网页无法直接访问本地磁盘。若需每次自选保存位置，可在浏览器中开启设置：'
                    )}
                  </p>

                  {showGuide && (
                    <div className="pt-1.5 border-t border-slate-200/70 space-y-1.5 text-slate-600 animate-fade-in">
                      <div className="p-2 bg-white rounded-lg border border-slate-200/60 space-y-1 font-mono text-[10.5px]">
                        <div className="text-slate-700">
                          📌 {t('downloadModal.guideChromeEdge', 'Chrome / Edge: 设置 → 下载内容 → 开启「下载前询问每个文件的保存位置」')}
                        </div>
                        <div className="text-slate-700">
                          📌 {t('downloadModal.guideFirefox', 'Firefox: 设置 → 常规 → 下载 → 开启「每次都询问保存文件的位置」')}
                        </div>
                      </div>
                      <p className="text-emerald-700 font-medium">
                        ✨ {t(
                          'downloadModal.guideResult',
                          '开启后点击「确认下载」，系统将自动弹出「另存为」窗口让您自由选择任意磁盘或文件夹。'
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 支持 File System Access API 时的展示 (如 Localhost 或 HTTPS 环境) */
              <div className="space-y-2">
                {/* 选项 1: 系统默认下载目录 */}
                <div
                  onClick={handleSelectDefault}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                    selectedType === 'browser_default'
                      ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-100 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="pt-0.5">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                        selectedType === 'browser_default'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selectedType === 'browser_default' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                        {t('downloadModal.destDefaultTitle', {
                          osFolder,
                          defaultValue: `系统默认下载目录 (${osFolder})`,
                        })}
                      </span>
                      {directoryInfo.type === 'browser_default' && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {t('downloadModal.savedDirBadge', '上次使用的设置')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {t('downloadModal.destDefaultDesc', {
                        osName,
                        defaultValue: `文件直接保存至 ${osName}「下载」文件夹，免授权、零安全限制、最稳定快速。`,
                      })}
                    </p>
                  </div>
                </div>

                {/* 选项 2: 自定义本机独立目录 */}
                <div
                  onClick={handleSelectCustom}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                    selectedType === 'custom_directory'
                      ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-100 shadow-2xs'
                      : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="pt-0.5">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                        selectedType === 'custom_directory'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selectedType === 'custom_directory' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                        {t('downloadModal.destCustomTitle', '自定义本机独立目录')}
                      </span>
                      {directoryInfo.type === 'custom_directory' && directoryInfo.dirName && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-700 font-medium shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {t('downloadModal.savedDirBadge', '上次使用的设置')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <p className="text-[11px] text-slate-600 truncate font-mono min-w-0">
                        {directoryInfo.dirName ? (
                          <span className="font-semibold text-blue-900 bg-blue-100/70 px-1.5 py-0.5 rounded">
                            📁 {directoryInfo.dirName}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans">
                            {t('downloadModal.noDirChosen', '尚未指定专属文件夹 (需新建或选择子文件夹)')}
                          </span>
                        )}
                      </p>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChangeCustomDirectory();
                        }}
                        disabled={downloading}
                        className="shrink-0 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-100/70 bg-white border border-blue-200 rounded-lg shadow-2xs transition active:scale-95 disabled:opacity-40"
                      >
                        {directoryInfo.dirName
                          ? t('downloadModal.changeDir', '更改目录')
                          : t('downloadModal.selectDir', '选择目录')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 仅在支持 API 且环境为 macOS 时，展示 macOS 系统的沙箱安全限制提示 */}
          {isSupported && isMac && (
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2.5 leading-relaxed">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                {t(
                  'downloadModal.macSystemFilesTip',
                  '提示：受 macOS 与 Chromium 安全策略限制，系统禁止直接授权根「下载」或「桌面」目录（会提示含有系统文件）。如需在下载目录中保存，请在其中【新建子文件夹】再选取；或者直接选择【系统默认下载目录】。'
                )}
              </span>
            </div>
          )}

          {/* 当用户触发“含系统文件”限制时的智能挽救区 */}
          {showBlockedNotice && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 animate-shake">
              <div className="flex items-start gap-2 text-xs text-rose-700 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  {t(
                    'downloadModal.systemFolderBlockedNotice',
                    '检测到受限系统目录。建议新建子文件夹后再选取，或直接切换为系统默认下载。'
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelectDefault}
                className="w-full py-2 px-3 bg-white hover:bg-rose-100/60 border border-rose-300 rounded-lg text-xs font-semibold text-rose-700 transition flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
              >
                <HardDrive className="w-3.5 h-3.5 text-rose-600" />
                <span>{t('downloadModal.switchToDefaultBtn', '一键使用系统默认下载目录')}</span>
              </button>
            </div>
          )}

          {/* 进度显示 */}
          {downloading && (
            <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  {t('downloadModal.downloading', '正在下载并保存至本地...')}
                </span>
                {progress.total > 0 && <span>{progress.percent}%</span>}
              </div>
              {progress.total > 0 && (
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* 错误提示 */}
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="break-all">{errorMessage}</span>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={downloading}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition disabled:opacity-40"
          >
            {t('downloadModal.btnCancel', '取消')}
          </button>

          <button
            type="button"
            onClick={handleStartDownload}
            disabled={downloading}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('downloadModal.downloading', '正在下载...')}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{t('downloadModal.btnConfirm', '确认下载')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
