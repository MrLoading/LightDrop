import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  Copy,
  Check,
  Network,
  CheckCircle2,
  Wifi,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Bell,
  Radio,
  Bookmark,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NetworkIpInfo } from '@shared/types';
import { copyToClipboard } from '../utils/clipboard';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessUrl: string;
  ipList?: NetworkIpInfo[];
  bonjourUrl?: string;
  bonjourHost?: string;
  onSelectUrl?: (url: string) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  accessUrl,
  ipList = [],
  bonjourUrl,
  bonjourHost,
  onSelectUrl,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'bonjour' | 'ip'>('bonjour');
  const [selectedIpUrl, setSelectedIpUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  // 纯真实物理 IP 列表
  const physicalIps = ipList.filter((item) => !item.isBonjour);
  const effectiveBonjourUrl =
    bonjourUrl || ipList.find((item) => item.isBonjour)?.url || '';

  // 当弹窗打开时初始化状态
  useEffect(() => {
    if (isOpen) {
      if (effectiveBonjourUrl) {
        setMode('bonjour');
      } else {
        setMode('ip');
      }

      if (physicalIps.length > 0) {
        const defaultItem = physicalIps.find((item) => item.isDefault) || physicalIps[0];
        setSelectedIpUrl(defaultItem.url);
      } else {
        setSelectedIpUrl(accessUrl || window.location.origin);
      }
    }
  }, [isOpen, effectiveBonjourUrl, accessUrl]);

  if (!isOpen) return null;

  const currentDisplayUrl =
    mode === 'bonjour' && effectiveBonjourUrl
      ? effectiveBonjourUrl
      : selectedIpUrl || accessUrl || window.location.origin;

  const handleSelectIp = (url: string) => {
    setSelectedIpUrl(url);
    if (onSelectUrl) {
      onSelectUrl(url);
    }
  };

  const handleSelectBonjour = () => {
    setMode('bonjour');
    if (effectiveBonjourUrl && onSelectUrl) {
      onSelectUrl(effectiveBonjourUrl);
    }
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(currentDisplayUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleGuide = () => {
    const nextState = !guideOpen;
    setGuideOpen(nextState);
    if (nextState) {
      setTimeout(() => {
        guideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        {/* 顶部固定标题栏 */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 leading-tight truncate">
                {t('qrModal.title')}
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                {t('qrModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition cursor-pointer shrink-0 ml-2"
            title={t('qrModal.close', '关闭')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 可滚动内容主体 */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar space-y-3.5 flex flex-col items-center">
          {/* 标签切换栏：稳定本地域名 (.local) vs 物理网卡直接 IP */}
          {effectiveBonjourUrl && (
            <div className="w-full shrink-0 grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl text-xs">
              <button
                type="button"
                onClick={handleSelectBonjour}
                className={`py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                  mode === 'bonjour'
                    ? 'bg-white text-blue-600 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('qrModal.tabStableDomain', '稳定域名 (.local)')}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('ip')}
                className={`py-1.5 px-2 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                  mode === 'ip'
                    ? 'bg-white text-blue-600 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('qrModal.tabDirectIp', '直接 IP 访问')}</span>
              </button>
            </div>
          )}

          {/* 模式 1：稳定本地域名突出说明 */}
          {mode === 'bonjour' && effectiveBonjourUrl && (
            <div className="w-full shrink-0 p-2.5 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/70 rounded-xl text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                  {t('qrModal.stableDomainBadge', '🍎 手机首选 · 免换IP')}
                </span>
                <span className="text-xs font-mono font-bold text-blue-900 truncate">
                  {bonjourHost || effectiveBonjourUrl}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {t(
                  'qrModal.stableDomainDesc',
                  '通过 Bonjour / mDNS 局域网协议，无论当前电脑切换哪个 Wi-Fi，手机访问该域名均自动解析最新 IP。手机添加到主屏幕/书签后无需重复扫码！'
                )}
              </p>
            </div>
          )}

          {/* 模式 2：物理网卡选择器 */}
          {mode === 'ip' && physicalIps.length > 1 && (
            <div className="w-full shrink-0 text-left">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <Network className="w-3.5 h-3.5 text-blue-500" />
                  {t('qrModal.selectIp')}
                </span>
                <span className="text-[10px] text-slate-400">
                  {t('qrModal.detectedNics', { count: physicalIps.length })}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto pr-0.5 custom-scrollbar">
                {physicalIps.map((item) => {
                  const isChecked = selectedIpUrl === item.url;
                  return (
                    <button
                      key={`${item.name}-${item.ip}`}
                      type="button"
                      onClick={() => handleSelectIp(item.url)}
                      className={`w-full text-left p-2 rounded-xl border transition flex items-center justify-between text-xs ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-medium shadow-xs'
                          : 'border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                          {item.name}
                        </span>
                        <span className="font-mono text-xs truncate">{item.ip}</span>
                        {item.isDefault && (
                          <span className="text-[10px] bg-sky-100 text-sky-700 px-1 rounded shrink-0">
                            {t('qrModal.recommended')}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0 ml-2">
                        {isChecked ? (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 二维码展示区 */}
          <div className="w-full shrink-0 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-inner flex flex-col items-center">
            <QRCodeSVG value={currentDisplayUrl} size={156} level="M" />
            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <Wifi className="w-3 h-3 text-sky-500" />
              {t('qrModal.cameraTip')}
            </div>
          </div>

          {/* 当前访问地址及复制按钮 */}
          <div className="w-full shrink-0 flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-mono text-slate-700">
            <span className="truncate max-w-[270px] text-left select-all">{currentDisplayUrl}</span>
            <button
              onClick={handleCopy}
              className={`p-1.5 rounded-lg border transition active:scale-95 flex items-center gap-1 text-[11px] font-sans shrink-0 ml-1 ${
                copied
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 border-slate-200'
              }`}
              title={t('qrModal.copyLink')}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{t('qrModal.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t('qrModal.copyLink')}</span>
                </>
              )}
            </button>
          </div>

          {/* 电脑 Wi-Fi 切换后手机快速感知折叠指南卡片 */}
          <div
            ref={guideRef}
            className="w-full shrink-0 border border-slate-200/80 rounded-xl overflow-hidden text-left bg-slate-50/50 shadow-2xs"
          >
            <button
              type="button"
              onClick={handleToggleGuide}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100/60 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                {t('qrModal.discoveryGuideTitle', '电脑 Wi-Fi 切换后，手机如何快速感知？')}
              </span>
              {guideOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {guideOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100 text-[11px] animate-fade-in bg-slate-50/30">
                {/* 方案 1 */}
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1 mb-0.5">
                    <Bookmark className="w-3 h-3 text-blue-600 shrink-0" />
                    <span>{t('qrModal.guideTip1Title', '方案 1：使用稳定域名 (.local)')}</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    {t(
                      'qrModal.guideTip1Desc',
                      '手机使用本页面推荐的 .local 稳定域名。Mac 无论切换哪个 Wi-Fi，.local 域名均自动解析到新 IP，手机直接访问永久有效。'
                    )}
                  </p>
                </div>

                {/* 方案 2 */}
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1 mb-0.5">
                    <Radio className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{t('qrModal.guideTip2Title', '方案 2：Mac 原生桌面通知')}</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    {t(
                      'qrModal.guideTip2Desc',
                      '电脑切换 Wi-Fi 时，Mac 右上角会自动弹出系统通知，清晰显示当前最新局域网 IP 与访问地址。'
                    )}
                  </p>
                </div>

                {/* 方案 3 */}
                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <div className="font-bold text-slate-800 flex items-center gap-1 mb-0.5">
                    <Bell className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{t('qrModal.guideTip3Title', '方案 3：手机实时推送 (Bark / Webhook)')}</span>
                  </div>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    {t(
                      'qrModal.guideTip3Desc',
                      '在设置中心填入 Bark URL，电脑切换 Wi-Fi 时手机将即刻收到通知横幅，点击通知直接在手机浏览器中打开最新服务。'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部固定操作栏 */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/60 shrink-0 w-full">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-[0.99]"
          >
            {t('qrModal.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
