import React, { useState, useRef, useEffect } from 'react';
import {
  Edit3,
  UploadCloud,
  FolderUp,
  Send,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  FileCheck2,
  Lock,
  Eye,
  EyeOff,
  XCircle,
  X,
  Loader2,
  ClipboardPaste,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractDroppedItems, ProcessedFolder } from '../utils/dragDrop';
import { UploadProgressInfo } from '../utils/uploader';
import { formatBytes } from '../utils/format';

interface SendCardProps {
  onSendText: (content: string, title?: string, password?: string) => Promise<any>;
  onUploadFiles: (
    files: FileList | File[],
    password?: string,
    onProgress?: (info: UploadProgressInfo) => void,
    setAbortHandle?: (abortFn: () => void) => void
  ) => Promise<any>;
  onUploadFolder: (
    files: FileList,
    password?: string,
    onProgress?: (info: UploadProgressInfo) => void,
    setAbortHandle?: (abortFn: () => void) => void
  ) => Promise<any>;
  onUploadMixedBatch: (
    individualFiles: File[],
    folders: ProcessedFolder[],
    password?: string,
    onProgress?: (info: UploadProgressInfo) => void,
    setAbortHandle?: (abortFn: () => void) => void
  ) => Promise<{ uploadedFilesCount: number; uploadedFoldersCount: number }>;
}

export const SendCard: React.FC<SendCardProps> = ({
  onSendText,
  onUploadFiles,
  onUploadFolder,
  onUploadMixedBatch,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordReadOnly, setPasswordReadOnly] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dragCounterRef = useRef(0);
  const abortRef = useRef<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // 严格杜绝任何浏览器自动填充凭证注入：初次挂载与延时强制清空
  useEffect(() => {
    setPassword('');
    const timer = setTimeout(() => {
      setPassword('');
      if (passwordInputRef.current) {
        passwordInputRef.current.value = '';
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const getEffectivePassword = () => (password.trim() ? password.trim() : undefined);

  const resetFormPassword = () => {
    setPassword('');
    setPasswordReadOnly(true);
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastMsg({ type, text: message });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // 用户点击取消上传
  const handleCancelUpload = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setSubmitting(false);
    setUploadProgress(null);
    setSubmittingStatus('');
    showToast('error', t('send.toastCancelUpload'));
  };

  const handleSend = async () => {
    if (!text.trim()) {
      showToast('error', t('send.toastEmpty'));
      return;
    }
    const currentPwd = getEffectivePassword();
    try {
      setSubmitting(true);
      setSubmittingStatus(t('send.processing'));
      await onSendText(text, undefined, currentPwd);
      setText('');
      resetFormPassword();
      showToast(
        'success',
        currentPwd ? t('send.toastSentProtected') : t('send.toastSent')
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Error');
    } finally {
      setSubmitting(false);
      setSubmittingStatus('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const currentPwd = getEffectivePassword();
      try {
        setSubmitting(true);
        setSubmittingStatus(t('send.uploadingFilesCount', { count: e.target.files.length }));
        setUploadProgress({ percent: 0, loaded: 0, total: 0 });

        await onUploadFiles(
          e.target.files,
          currentPwd,
          (info) => setUploadProgress(info),
          (abortFn) => {
            abortRef.current = abortFn;
          }
        );

        resetFormPassword();
        showToast(
          'success',
          t('send.toastUploadSuccess', {
            count: e.target.files.length,
            extra: currentPwd ? t('send.toastEncrypted') : '',
          })
        );
      } catch (err: any) {
        if (err?.message !== t('send.toastCancelUpload')) {
          showToast('error', err?.message || t('send.errUploadFailed'));
        }
      } finally {
        setSubmitting(false);
        setSubmittingStatus('');
        setUploadProgress(null);
        abortRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const currentPwd = getEffectivePassword();
      try {
        setSubmitting(true);
        setSubmittingStatus(t('send.processing'));
        setUploadProgress({ percent: 0, loaded: 0, total: 0 });

        await onUploadFolder(
          e.target.files,
          currentPwd,
          (info) => setUploadProgress(info),
          (abortFn) => {
            abortRef.current = abortFn;
          }
        );

        resetFormPassword();
        showToast(
          'success',
          t('send.toastUploadFolderSuccess', {
            count: e.target.files.length,
            extra: currentPwd ? t('send.toastEncrypted') : '',
          })
        );
      } catch (err: any) {
        if (err?.message !== t('send.toastCancelUpload')) {
          showToast('error', err?.message || t('send.errUploadFailed'));
        }
      } finally {
        setSubmitting(false);
        setSubmittingStatus('');
        setUploadProgress(null);
        abortRef.current = null;
        if (folderInputRef.current) folderInputRef.current.value = '';
      }
    }
  };

  // 严谨的拖拽进入/移出事件
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  // 统一上传混合项 (文件 + 文件夹，供拖拽和剪贴板复用)
  const uploadMixedItems = async (
    individualFiles: File[],
    folders: ProcessedFolder[],
    sourceName?: string
  ) => {
    const totalFilesCount = individualFiles.length;
    const totalFoldersCount = folders.length;
    const resolvedSource = sourceName || t('send.sourceClipboard');

    if (totalFilesCount === 0 && totalFoldersCount === 0) {
      showToast('error', t('send.errNoUploadable'));
      return;
    }

    try {
      setSubmitting(true);
      setSubmittingStatus(
        t('send.uploadingMixed', {
          files: totalFilesCount > 0 ? t('send.filesCount', { count: totalFilesCount }) : '',
          separator: totalFilesCount > 0 && totalFoldersCount > 0 ? t('send.andSeparator') : '',
          folders: totalFoldersCount > 0 ? t('send.foldersCount', { count: totalFoldersCount }) : '',
        })
      );
      setUploadProgress({ percent: 0, loaded: 0, total: 0 });

      const currentPwd = getEffectivePassword();
      const result = await onUploadMixedBatch(
        individualFiles,
        folders,
        currentPwd,
        (info) => setUploadProgress(info),
        (abortFn) => {
          abortRef.current = abortFn;
        }
      );
      resetFormPassword();

      const successParts: string[] = [];
      if (result.uploadedFilesCount > 0) {
        successParts.push(t('send.filesCount', { count: result.uploadedFilesCount }));
      }
      if (result.uploadedFoldersCount > 0) {
        successParts.push(t('send.foldersCount', { count: result.uploadedFoldersCount }));
      }

      showToast(
        'success',
        t('send.toastUploadFromSourceSuccess', {
          source: resolvedSource,
          parts: successParts.join(t('send.commaSeparator')),
          extra: currentPwd ? t('send.toastEncrypted') : '',
        })
      );
    } catch (err: any) {
      if (err?.message !== t('send.toastCancelUpload')) {
        showToast('error', err?.message || t('send.errUploadFailed'));
      }
    } finally {
      setSubmitting(false);
      setSubmittingStatus('');
      setUploadProgress(null);
      abortRef.current = null;
    }
  };

  // 统一上传纯文件列表 (供选择文件、剪贴板图片等复用)
  const uploadFileList = async (files: File[], sourceName?: string) => {
    if (files.length === 0) return;
    const currentPwd = getEffectivePassword();
    const resolvedSource = sourceName || t('send.sourceClipboard');
    try {
      setSubmitting(true);
      setSubmittingStatus(t('send.uploadingFromSource', { source: resolvedSource, count: files.length }));
      setUploadProgress({ percent: 0, loaded: 0, total: 0 });

      await onUploadFiles(
        files,
        currentPwd,
        (info) => setUploadProgress(info),
        (abortFn) => {
          abortRef.current = abortFn;
        }
      );

      resetFormPassword();
      showToast(
        'success',
        t('send.toastUploadFromSourceSuccess', {
          source: resolvedSource,
          parts: t('send.filesCount', { count: files.length }),
          extra: currentPwd ? t('send.toastEncrypted') : '',
        })
      );
    } catch (err: any) {
      if (err?.message !== t('send.toastCancelUpload')) {
        showToast('error', err?.message || t('send.errUploadFilesFailed'));
      }
    } finally {
      setSubmitting(false);
      setSubmittingStatus('');
      setUploadProgress(null);
      abortRef.current = null;
    }
  };

  // 探测 File 对象是否真实为不可读的操作系统目录
  const isDirectoryFile = async (file: File): Promise<boolean> => {
    try {
      // 尝试读取切片的 1 字节数据，如果是目录，现代浏览器网络/文件引擎会立即抛出 NotReadableError
      await file.slice(0, 1).arrayBuffer();
      return false;
    } catch {
      return true;
    }
  };

  // 从剪贴板中严格提取真实常规文件，并精确识别拦截操作系统文件夹
  const extractClipboardFiles = async (
    clipboardData: DataTransfer
  ): Promise<{ validFiles: File[]; detectedDirectories: string[] }> => {
    const validFiles: File[] = [];
    const detectedDirectories: string[] = [];

    // 1. 优先检查 DataTransferItem.webkitGetAsEntry
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry && entry.isDirectory) {
            if (!detectedDirectories.includes(entry.name)) {
              detectedDirectories.push(entry.name);
            }
          }
        }
      }
    }

    // 2. 收集所有原始文件项
    const rawFiles: File[] = [];
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        rawFiles.push(clipboardData.files[i]);
      }
    } else if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) rawFiles.push(f);
        }
      }
    }

    // 3. 异步探测每一个文件，精准剥离不可读的目录壳
    for (const file of rawFiles) {
      const isDir = await isDirectoryFile(file);
      if (isDir) {
        if (!detectedDirectories.includes(file.name)) {
          detectedDirectories.push(file.name);
        }
      } else {
        validFiles.push(file);
      }
    }

    return { validFiles, detectedDirectories };
  };

  // 检测纯文本是否为本地文件或本地路径 (防止浏览器沙箱导致的“复制文件只拿到了文件名”被误当成文本发送)
  const isLocalFileOrPathText = (str: string): boolean => {
    const trimmed = str.trim();
    if (!trimmed) return false;
    // file:///... 或以斜杠开头的路径
    if (/^(file:\/\/\/|[a-zA-Z]:\\|\/)/.test(trimmed)) return true;
    // 单行且以常见文件扩展名结尾 (例如 "明信片反.png", "doc.pdf", "project.zip")
    if (
      !trimmed.includes('\n') &&
      trimmed.length < 256 &&
      /\.(png|jpe?g|gif|webp|bmp|svg|pdf|docx?|xlsx?|pptx?|txt|md|zip|tar|gz|7z|rar|mp4|mov|mp3|wav|dmg|pkg|exe|apk|ipa)$/i.test(
        trimmed
      )
    ) {
      return true;
    }
    return false;
  };

  // 深度解析拖拽内容：文件、文件夹、混合项
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragActive(false);

    try {
      setSubmitting(true);
      setSubmittingStatus(t('send.parsingDrop'));
      setUploadProgress({ percent: 0, loaded: 0, total: 0 });

      const { individualFiles, folders } = await extractDroppedItems(e.dataTransfer);
      await uploadMixedItems(individualFiles, folders, t('send.sourceDrop'));
    } catch (err: any) {
      if (err?.message !== t('send.toastCancelUpload')) {
        showToast('error', err?.message || t('send.errDropFailed'));
      }
    }
  };

  // 剪贴板快捷键粘贴拦截处理 (Ctrl+V / Cmd+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    e.stopPropagation();
    if (submitting) return;
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // 1. 深度探测并提取真实文件与文件夹条目
    const { validFiles, detectedDirectories } = await extractClipboardFiles(clipboardData);

    // 如果检测到操作系统文件夹，绝对不发起 XHR 上传，直接拦截并给出专业指导！
    if (detectedDirectories.length > 0) {
      e.preventDefault();
      const dirName = detectedDirectories[0] || t('send.defaultFolderName');
      showToast('error', t('send.errClipboardFolder', { name: dirName }));
      return;
    }

    // 如果包含常规真实文件，立即执行上传流程
    if (validFiles.length > 0) {
      e.preventDefault();
      await uploadFileList(validFiles, t('send.sourceShortcutPaste'));
      return;
    }

    // 2. 尝试解析拖拽/剪贴板混合项 (可能包含支持的目录结构)
    try {
      const { individualFiles, folders } = await extractDroppedItems(clipboardData);
      if (individualFiles.length > 0 || folders.length > 0) {
        e.preventDefault();
        // 立即执行上传流程！
        await uploadMixedItems(individualFiles, folders, t('send.sourceShortcutPaste'));
        return;
      }
    } catch (err) {
      // ignore
    }

    // 3. 检查纯文本内容：
    const pastedText = clipboardData.getData('text/plain');
    if (pastedText && isLocalFileOrPathText(pastedText)) {
      // 用户在操作系统复制了本地文件，但当前浏览器沙箱由于权限未提供文件二进制流，仅给出了文件名
      e.preventDefault();
      showToast('error', t('send.errClipboardLocalFile', { name: pastedText.trim() }));
      // 贴心唤起系统文件选择框
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 200);
      return;
    }

    // 4. 若为普通文字、代码或链接，允许浏览器默认将文字粘贴进 textarea
  };

  // 主动点击【粘贴剪切板】按钮处理：读取并立即执行上传/发送流程
  const handlePasteFromClipboard = async () => {
    if (submitting) return;

    if (!navigator.clipboard) {
      showToast('error', t('send.errClipboardNotSupported'));
      return;
    }

    try {
      // 1. 优先尝试读取富媒体 (图片、截图等)
      if (typeof navigator.clipboard.read === 'function') {
        try {
          const clipboardItems = await navigator.clipboard.read();
          const imageFiles: File[] = [];

          for (const item of clipboardItems) {
            for (const type of item.types) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
                const file = new File(
                  [blob],
                  `${t('send.clipboardImagePrefix')}_${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${ext}`,
                  { type }
                );
                imageFiles.push(file);
              }
            }
          }

          if (imageFiles.length > 0) {
            // 立即执行上传流程！
            await uploadFileList(imageFiles, t('send.sourceSystemClipboard'));
            return;
          }
        } catch (readErr) {
          console.warn('[Clipboard] read() fallback to readText():', readErr);
        }
      }

      // 2. 读取剪贴板纯文本
      const textContent = await navigator.clipboard.readText();
      const trimmedText = textContent ? textContent.trim() : '';
      if (trimmedText) {
        // 检查是否为文件名/路径 (防止将文件名当成文本记录发出去)
        if (isLocalFileOrPathText(trimmedText)) {
          showToast('error', t('send.errClipboardLocalFile', { name: trimmedText }));
          setTimeout(() => {
            fileInputRef.current?.click();
          }, 200);
          return;
        }

        // 普通文本：填入输入框并立即自动执行发送流程！
        setText(trimmedText);
        setSubmitting(true);
        setSubmittingStatus(t('send.sendingClipboardText'));
        const currentPwd = getEffectivePassword();
        try {
          await onSendText(trimmedText, undefined, currentPwd);
          setText('');
          resetFormPassword();
          showToast('success', t('send.toastClipboardTextSuccess', { extra: currentPwd ? t('send.toastEncrypted') : '' }));
        } catch (sendErr: any) {
          showToast('error', sendErr?.message || t('send.errSendTextFailed'));
        } finally {
          setSubmitting(false);
          setSubmittingStatus('');
        }
        return;
      }

      showToast('error', t('send.errClipboardEmpty'));
    } catch (err: any) {
      showToast('error', t('send.errClipboardReadFailed'));
    }
  };

  // 窗口全局快捷键粘贴监听 (未聚焦输入框时，在页面按 Cmd+V / Ctrl+V 也可直接上传文件)
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (submitting) return;
      const activeEl = document.activeElement;
      // 若当前用户正聚焦在其它文本输入框 (如搜索栏)，不作全局抢占
      if (
        activeEl &&
        activeEl !== document.body &&
        activeEl !== document.documentElement &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.clipboardData) {
        const { validFiles, detectedDirectories } = await extractClipboardFiles(e.clipboardData);
        if (detectedDirectories.length > 0) {
          e.preventDefault();
          showToast(
            'error',
            t('send.errClipboardFolder', { name: detectedDirectories[0] || t('send.defaultFolderName') })
          );
          return;
        }

        if (validFiles.length > 0) {
          e.preventDefault();
          uploadFileList(validFiles, t('send.sourceGlobalPaste'));
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [submitting]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 transition-all duration-200 relative overflow-hidden h-full flex flex-col justify-between focus:outline-none"
    >
      {/* 拖拽悬浮覆盖层 */}
      {dragActive && (
        <div className="absolute inset-0 z-30 bg-blue-600/95 backdrop-blur-md rounded-2xl p-6 flex flex-col items-center justify-center text-white text-center animate-fade-in border-2 border-dashed border-white/60 pointer-events-none select-none">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3 shadow-inner">
            <FolderTree className="w-9 h-9 text-white animate-bounce" />
          </div>
          <h3 className="text-base font-bold tracking-tight">{t('send.dropTitle')}</h3>
          <p className="text-xs text-blue-100 mt-1.5 max-w-sm">
            {t('send.dropDesc')}
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20">
            <span className="flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5" /> {t('send.dropFiles')}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <FolderUp className="w-3.5 h-3.5" /> {t('send.dropFolders')}
            </span>
          </div>
        </div>
      )}

      {/* 实时上传进度面板 (拖拽或选择上传时展示，带取消按钮) */}
      {submitting && uploadProgress !== null && (
        <div className="mb-4 bg-blue-50/80 border border-blue-200/80 rounded-xl p-3.5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              <span className="text-xs font-semibold text-blue-900 truncate">
                {submittingStatus || t('send.uploading')}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono font-bold text-blue-600">
                {uploadProgress.percent}%
              </span>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[11px] font-medium transition active:scale-95"
                title={t('send.cancelUpload')}
              >
                <XCircle className="w-3 h-3" />
                {t('send.cancel')}
              </button>
            </div>
          </div>

          {/* 进度条指示器 */}
          <div className="w-full bg-blue-200/50 rounded-full h-2 overflow-hidden mb-1.5">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${Math.max(2, uploadProgress.percent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>
              {uploadProgress.total > 0
                ? `${formatBytes(uploadProgress.loaded)} / ${formatBytes(uploadProgress.total)}`
                : t('send.transferring')}
            </span>
            {uploadProgress.speedText && <span>{uploadProgress.speedText}</span>}
          </div>
        </div>
      )}

      {/* 消息提示浮层 */}
      {toastMsg && (
        <div
          className={`absolute top-3 right-5 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm animate-fade-in ${
            toastMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          {toastMsg.text}
        </div>
      )}

      {/* 头部标题与剪贴板操作 */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">{t('send.title')}</h2>
          <span className="hidden sm:inline-block text-[11px] text-slate-400 font-normal">
            {t('send.subtitle')}
          </span>
        </div>

        {/* 粘贴剪切板按钮 */}
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200/80 text-xs font-medium transition active:scale-95 disabled:opacity-50 shadow-2xs"
          title={t('send.pasteClipboardTitle')}
        >
          <ClipboardPaste className="w-3.5 h-3.5 text-blue-600" />
          <span>{t('send.pasteClipboard')}</span>
        </button>
      </div>

      {/* 文本输入框 */}
      <div className="relative mb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          placeholder={t('send.placeholder')}
          rows={5}
          maxLength={10000}
          disabled={submitting}
          className="w-full text-xs sm:text-sm p-3.5 bg-slate-50/60 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 placeholder-slate-400 transition resize-none disabled:opacity-50"
        />
        <div className="absolute right-3 bottom-3 text-[11px] font-mono text-slate-400 select-none">
          {text.length} / 10000
        </div>
      </div>

      {/* 访问密码设置栏 (常驻显示，默认为空，输入即生效，带清空图标) */}
      <div
        className={`mb-3.5 rounded-xl p-2.5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
          password.trim()
            ? 'bg-amber-50/70 border-amber-200/90 shadow-sm'
            : 'bg-slate-50/70 hover:bg-slate-50 border-slate-200/80'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition ${
              password.trim() ? 'bg-amber-100 text-amber-700' : 'bg-slate-200/70 text-slate-500'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span
              className={`text-xs font-semibold tracking-tight ${
                password.trim() ? 'text-amber-900' : 'text-slate-700'
              }`}
            >
              {t('send.passwordLabel')}
            </span>
            <span className="text-[11px] text-slate-400">
              {password.trim()
                ? t('send.passwordProtected')
                : t('send.passwordPublic')}
            </span>
          </div>
        </div>

        <div className="relative w-full sm:w-60 shrink-0">
          <input
            ref={passwordInputRef}
            type={showPassword ? 'text' : 'password'}
            name="easydrop_custom_token_no_fill"
            id="easydrop_custom_token_no_fill"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={passwordReadOnly}
            onFocus={() => setPasswordReadOnly(false)}
            onBlur={() => {
              if (!password) setPasswordReadOnly(true);
            }}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('send.passwordPlaceholder')}
            disabled={submitting}
            className={`w-full pl-3 pr-16 py-1.5 text-xs bg-white border rounded-lg focus:outline-none font-mono text-slate-800 shadow-sm transition disabled:opacity-50 ${
              password.trim()
                ? 'border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-400'
                : 'border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
            }`}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
            {password.length > 0 && (
              <button
                type="button"
                onClick={() => setPassword('')}
                disabled={submitting}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                title={t('send.clearPassword')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={submitting}
              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              title={showPassword ? t('send.hidePassword') : t('send.showPassword')}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 上传文件与上传文件夹两列按钮 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* 上传文件 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting}
          className="flex items-center justify-center gap-2.5 p-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-blue-600 transition group active:scale-[0.99] disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-100/80 flex items-center justify-center group-hover:scale-105 transition">
            <UploadCloud className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-blue-700">{t('send.uploadFiles')}</div>
            <div className="text-[10px] text-slate-400">{t('send.uploadFilesDesc')}</div>
          </div>
        </button>

        {/* 上传文件夹 */}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          // @ts-ignore
          directory=""
          multiple
          onChange={handleFolderChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          disabled={submitting}
          className="flex items-center justify-center gap-2.5 p-3 rounded-xl border border-dashed border-sky-200 bg-sky-50/40 hover:bg-sky-50 text-sky-600 transition group active:scale-[0.99] disabled:opacity-50"
        >
          <div className="w-8 h-8 rounded-lg bg-sky-100/80 flex items-center justify-center group-hover:scale-105 transition">
            <FolderUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold text-sky-700">{t('send.uploadFolder')}</div>
            <div className="text-[10px] text-slate-400">{t('send.uploadFolderDesc')}</div>
          </div>
        </button>
      </div>

      {/* 主发送按钮 */}
      <button
        type="button"
        onClick={handleSend}
        disabled={submitting || !text.trim()}
        className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 active:scale-[0.99] text-white rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
      >
        <Send className="w-4 h-4 fill-white stroke-none" />
        {submitting ? submittingStatus || t('send.processing') : t('send.sendBtn')}
      </button>
    </div>
  );
};
