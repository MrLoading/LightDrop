import React, { useState, useEffect } from 'react';
import { Users, BarChart2, HardDrive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SystemStats } from '@shared/types';
import { formatBytes } from '../utils/format';

interface FooterProps {
  stats: SystemStats;
  onlineCount: number;
}

export const Footer: React.FC<FooterProps> = ({ stats, onlineCount }) => {
  const { t } = useTranslation();
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${year}-${month}-${day} ${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="mt-6 py-4 border-t border-slate-200/60 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {/* 左侧：3 个指标 */}
      <div className="flex items-center flex-wrap gap-4 sm:gap-6">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>{t('footer.onlineVisitors')}</span>
          <span className="font-semibold text-slate-800">{onlineCount || stats.onlineUsers || 1}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
          <span>{t('footer.todaySent')}</span>
          <span className="font-semibold text-slate-800">{stats.todaySentCount}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          <span>{t('footer.currentStorage')}</span>
          <span className="font-semibold text-slate-800">{formatBytes(stats.totalStorageBytes)}</span>
        </div>
      </div>

      {/* 右侧：服务健康状态和系统时间 */}
      <div className="flex items-center gap-2 text-slate-400">
        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          {t('footer.serviceHealthy')}
        </span>
        <span>|</span>
        <span className="font-mono text-slate-400">{currentTimeStr}</span>
      </div>
    </footer>
  );
};
