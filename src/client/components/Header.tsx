import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  Copy,
  Check,
  RotateCw,
  Settings,
  QrCode,
  Download,
  ChevronDown,
  Network,
  CheckCircle2,
  Languages,
  Edit3,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NetworkIpInfo } from '@shared/types';
import { copyToClipboard } from '../utils/clipboard';
import { changeAppLanguage } from '../i18n';
import { useNickname } from '../utils/nickname';

interface HeaderProps {
  accessUrl: string;
  ipList?: NetworkIpInfo[];
  currentUrl?: string;
  onSelectUrl?: (url: string) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenQrCode: () => void;
  isRefreshing?: boolean;
  isConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  accessUrl,
  ipList = [],
  currentUrl,
  onSelectUrl,
  onRefresh,
  onOpenSettings,
  onOpenQrCode,
  isRefreshing = false,
  isConnected = true,
}) => {
  const { t, i18n } = useTranslation();
  const { nickname, charInfo, updateNickname, randomizeNickname, allCharacters } = useNickname();
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [nicknameDropdownOpen, setNicknameDropdownOpen] = useState(false);
  const [inputNickname, setInputNickname] = useState(nickname);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const nicknameDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputNickname(nickname);
  }, [nickname]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (nicknameDropdownRef.current && !nicknameDropdownRef.current.contains(event.target as Node)) {
        setNicknameDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveNickname = () => {
    if (inputNickname.trim()) {
      updateNickname(inputNickname.trim());
    }
    setNicknameDropdownOpen(false);
  };

  // 监听 PWA 安装事件
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const activeDisplayUrl = currentUrl || accessUrl || window.location.origin;

  const handleCopyUrl = async (e?: React.MouseEvent, urlToCopy?: string) => {
    if (e) e.stopPropagation();
    const target = urlToCopy || activeDisplayUrl;
    const ok = await copyToClipboard(target);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectIp = (url: string) => {
    if (onSelectUrl) {
      onSelectUrl(url);
    }
    setDropdownOpen(false);
  };

  return (
    <header className="w-full mb-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* 左侧：Logo、标题、长连接徽章 */}
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <Zap className="w-5 h-5 fill-white stroke-none" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">{t('header.title')}</h1>
            {isConnected ? (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200/60"
                title={t('header.connectedTitle')}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {t('header.connected')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200/60 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {t('header.reconnecting')}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 pl-0.5">
            {t('header.subtitle')}
          </p>
        </div>

        {/* 右侧：地址胶囊 (带多网卡IP切换)、语言切换、刷新、设置 */}
        <div className="flex items-center flex-wrap gap-2">
          {/* PWA 安装入口 (若支持) */}
          {deferredPrompt && (
            <button
              onClick={handleInstallPwa}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition"
              title={t('header.installTitle')}
            >
              <Download className="w-3.5 h-3.5" />
              {t('header.installApp')}
            </button>
          )}

          {/* 角色昵称胶囊 (默认随机海绵宝宝角色，可编辑并持久化缓存到浏览器) */}
          <div className="relative" ref={nicknameDropdownRef}>
            <button
              type="button"
              onClick={() => setNicknameDropdownOpen(!nicknameDropdownOpen)}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100/80 active:scale-95 border border-amber-200/80 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs text-amber-900 transition shadow-2xs select-none group"
              title={t('header.nicknameTip', '当前昵称 (点击设置或随机切换)')}
            >
              <span className="text-sm shrink-0 leading-none">{charInfo.emoji}</span>
              <span className="font-semibold text-xs tracking-tight truncate max-w-[85px] sm:max-w-[120px]">
                {nickname}
              </span>
              <Edit3 className="w-3 h-3 text-amber-500 group-hover:text-amber-700 transition shrink-0 ml-0.5" />
            </button>

            {/* 下拉编辑面板 */}
            {nicknameDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-3.5 z-50 animate-fade-in text-xs">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                    <span className="text-sm">{charInfo.emoji}</span>
                    <span>{t('header.nicknameSettings', '设置昵称')}</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200/60 font-medium">
                    {t('header.cachedTip', '已缓存至浏览器')}
                  </span>
                </div>

                {/* 昵称编辑输入行 */}
                <div className="flex items-center gap-1.5 mb-2.5">
                  <input
                    type="text"
                    value={inputNickname}
                    onChange={(e) => setInputNickname(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveNickname();
                      }
                    }}
                    placeholder={t('header.nicknamePlaceholder', '输入自定义昵称...')}
                    maxLength={16}
                    autoFocus
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-400 focus:bg-white text-slate-800 transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = randomizeNickname();
                      setInputNickname(next);
                    }}
                    className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 border border-amber-200/80 transition flex items-center justify-center shrink-0"
                    title={t('header.randomizeRole', '随机换一个海绵宝宝角色')}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNickname}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-xs transition shrink-0"
                  >
                    {t('header.saveNickname', '确定')}
                  </button>
                </div>

                {/* 快速选择角色列表 */}
                <div>
                  <div className="text-[10px] text-slate-400 font-medium mb-1.5 flex items-center justify-between">
                    <span>{t('header.quickPickRole', '海绵宝宝角色快速选择：')}</span>
                    <span className="text-[9px] text-amber-600 font-normal">点击即选</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto custom-scrollbar p-0.5">
                    {allCharacters.map((c) => {
                      const isCurrent = nickname === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            updateNickname(c.name);
                            setInputNickname(c.name);
                            setNicknameDropdownOpen(false);
                          }}
                          className={`flex items-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] transition text-left truncate ${
                            isCurrent
                              ? 'bg-amber-100/80 text-amber-900 border border-amber-300/80 font-bold shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                          }`}
                        >
                          <span className="text-xs shrink-0">{c.emoji}</span>
                          <span className="truncate">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
                  {t('header.nicknameNotice', '该昵称将关联于您发送的新增文件、操作记录以及共享记录中。')}
                </div>
              </div>
            )}
          </div>

          {/* 局域网访问地址胶囊框与多 IP 下拉菜单 */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/80 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs text-slate-600 transition shadow-sm">
              <span className="text-slate-400 mr-1.5 font-mono">🔗</span>
              <span
                className="font-mono font-medium max-w-[170px] sm:max-w-none truncate cursor-pointer"
                onClick={() => ipList.length > 1 && setDropdownOpen(!dropdownOpen)}
                title={ipList.length > 1 ? t('header.switchIpTitle') : activeDisplayUrl}
              >
                {activeDisplayUrl}
              </span>

              {/* 多网卡下拉指示器 */}
              {ipList && ipList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="ml-1 p-0.5 rounded text-slate-400 hover:text-blue-600 hover:bg-white/80 transition flex items-center"
                  title={`${t('header.detectedIps')} (${ipList.length})`}
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                </button>
              )}

              {/* 复制按钮 */}
              <button
                onClick={(e) => handleCopyUrl(e)}
                className="ml-1.5 p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white/80 transition"
                title={t('header.copyLink')}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* 扫码按钮 */}
              <button
                onClick={onOpenQrCode}
                className="ml-1 p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-white/80 transition"
                title={t('header.scanQr')}
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 展开的全部非回环 IP 浮层菜单 */}
            {dropdownOpen && ipList && ipList.length > 1 && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200/80 p-2 z-50 animate-fade-in text-xs">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[11px] text-slate-500 font-semibold px-1">
                  <span className="flex items-center gap-1">
                    <Network className="w-3.5 h-3.5 text-blue-500" />
                    {t('header.detectedIps')} ({ipList.length})
                  </span>
                  <span className="text-[10px] text-blue-600 font-normal">{t('header.clickSetDefault')}</span>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                  {ipList.map((item) => {
                    const isSelected = activeDisplayUrl === item.url || activeDisplayUrl.includes(item.ip);
                    return (
                      <div
                        key={`menu-${item.name}-${item.ip}`}
                        onClick={() => handleSelectIp(item.url)}
                        className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between group ${
                          isSelected
                            ? 'bg-blue-50/80 text-blue-900 border border-blue-200/60'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                        title={t('header.clickSetDefault')}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-100 group-hover:bg-white text-slate-600 border border-slate-200">
                              {item.name}
                            </span>
                            <span className="font-mono text-xs font-medium truncate">{item.ip}</span>
                            {isSelected ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 rounded font-medium">
                                {t('header.default')}
                              </span>
                            ) : item.isDefault ? (
                              <span className="text-[9px] bg-sky-100 text-sky-700 px-1 rounded">
                                {t('header.recommended')}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                            {item.url}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                          <button
                            type="button"
                            onClick={(e) => handleCopyUrl(e, item.url)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-white transition"
                            title={t('header.copyLink')}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 快捷语言切换按钮 */}
          <button
            onClick={() => {
              const currentLang = i18n.language || 'zh-CN';
              const nextLang = currentLang.toLowerCase().startsWith('zh') ? 'en-US' : 'zh-CN';
              changeAppLanguage(nextLang);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-xl text-xs font-semibold shadow-sm transition active:scale-95"
            title={(i18n.language || '').toLowerCase().startsWith('zh') ? 'Switch to English' : '切换为简体中文'}
          >
            <Languages className="w-3.5 h-3.5 text-blue-500" />
            <span>{(i18n.language || '').toLowerCase().startsWith('zh') ? 'EN' : '中'}</span>
          </button>

          {/* 刷新按钮 */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-xl text-xs font-medium shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            {t('header.refresh')}
          </button>

          {/* 设置入口按钮 */}
          <button
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-xl text-xs font-medium shadow-sm transition active:scale-95"
            title={t('header.settingsTitle')}
          >
            <Settings className="w-3.5 h-3.5" />
            {t('header.settings')}
          </button>
        </div>
      </div>
    </header>
  );
};
