import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Copy, Check, Network, CheckCircle2, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NetworkIpInfo } from '@shared/types';
import { copyToClipboard } from '../utils/clipboard';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessUrl: string;
  ipList?: NetworkIpInfo[];
  onSelectUrl?: (url: string) => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  accessUrl,
  ipList = [],
  onSelectUrl,
}) => {
  const { t } = useTranslation();
  const [selectedUrl, setSelectedUrl] = useState<string>(accessUrl);
  const [copied, setCopied] = useState(false);

  // 当弹窗打开或 accessUrl / ipList 变化时同步初始选择
  useEffect(() => {
    if (isOpen) {
      if (accessUrl) {
        setSelectedUrl(accessUrl);
      } else if (ipList.length > 0) {
        const defaultItem = ipList.find((item) => item.isDefault) || ipList[0];
        setSelectedUrl(defaultItem.url);
      } else {
        setSelectedUrl(window.location.origin);
      }
    }
  }, [isOpen, accessUrl, ipList]);

  if (!isOpen) return null;

  const currentUrl = selectedUrl || accessUrl || window.location.origin;

  const handleSelect = (url: string) => {
    setSelectedUrl(url);
    if (onSelectUrl) {
      onSelectUrl(url);
    }
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(currentUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-fade-in flex flex-col items-center">
        {/* 顶部图标与标题 */}
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
          <Smartphone className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-800">{t('qrModal.title')}</h3>
        <p className="text-xs text-slate-400 mt-0.5 mb-3.5">
          {t('qrModal.subtitle')}
        </p>

        {/* 若有多个非回环 IP，提供选择器 */}
        {ipList && ipList.length > 1 && (
          <div className="w-full mb-3 text-left">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                <Network className="w-3.5 h-3.5 text-blue-500" />
                {t('qrModal.selectIp')}
              </span>
              <span className="text-[10px] text-slate-400">
                {t('qrModal.detectedNics', { count: ipList.length })}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
              {ipList.map((item) => {
                const isChecked = currentUrl === item.url || currentUrl.includes(item.ip);
                return (
                  <button
                    key={`${item.name}-${item.ip}`}
                    type="button"
                    onClick={() => handleSelect(item.url)}
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
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-inner mb-3.5 flex flex-col items-center">
          <QRCodeSVG value={currentUrl} size={168} level="M" />
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1 font-mono">
            <Wifi className="w-3 h-3 text-sky-500" />
            {t('qrModal.cameraTip')}
          </div>
        </div>

        {/* 当前访问地址及复制按钮 */}
        <div className="w-full flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-mono text-slate-700 mb-4">
          <span className="truncate max-w-[280px] text-left">{currentUrl}</span>
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg border transition active:scale-95 flex items-center gap-1 text-[11px] font-sans ${
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

        {/* 底部按钮 */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
        >
          {t('qrModal.done')}
        </button>
      </div>
    </div>
  );
};
