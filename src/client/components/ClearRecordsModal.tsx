import React, { useState, useMemo } from 'react';
import {
  Trash2,
  X,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShareItem } from '@shared/types';
import { formatBytes } from '../utils/format';

export interface ClearRecordsOptions {
  mode: 'all' | 'by_time';
  timeMode?: 'relative' | 'before_date';
  relativeValue?: number;
  relativeUnit?: 'week' | 'month';
  beforeDate?: string;
}

interface ClearRecordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: ShareItem[];
  onConfirm: (options: ClearRecordsOptions) => Promise<void>;
}

export const ClearRecordsModal: React.FC<ClearRecordsModalProps> = ({
  isOpen,
  onClose,
  records,
  onConfirm,
}) => {
  const { t } = useTranslation();

  // 主模式：'all' (全部删除) | 'by_time' (指定时间删除)
  const [mainMode, setMainMode] = useState<'all' | 'by_time'>('all');

  // 时间子模式：'relative' (删除 x 周/月 前) | 'before_date' (删除指定年月日之前)
  const [timeSubMode, setTimeSubMode] = useState<'relative' | 'before_date'>('relative');

  // 相对时间参数
  const [relativeValue, setRelativeValue] = useState<number>(1);
  const [relativeUnit, setRelativeUnit] = useState<'week' | 'month'>('week');

  // 指定日期参数 (默认取今天的前一天)
  const [beforeDate, setBeforeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });

  const [loading, setLoading] = useState(false);

  // 预设计划药丸
  const PRESET_PILLS: Array<{ key: string; defaultLabel: string; value: number; unit: 'week' | 'month' }> = [
    { key: 'clearModal.pillWeek1', defaultLabel: '1 周前', value: 1, unit: 'week' },
    { key: 'clearModal.pillWeek2', defaultLabel: '2 周前', value: 2, unit: 'week' },
    { key: 'clearModal.pillMonth1', defaultLabel: '1 个月前', value: 1, unit: 'month' },
    { key: 'clearModal.pillMonth3', defaultLabel: '3 个月前', value: 3, unit: 'month' },
  ];

  // 计算截止时间点时间戳
  const cutoffTimestamp = useMemo(() => {
    if (mainMode === 'all') return null;

    if (timeSubMode === 'relative') {
      const now = Date.now();
      const ms =
        relativeValue * (relativeUnit === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000);
      return now - ms;
    }

    if (timeSubMode === 'before_date' && beforeDate) {
      return new Date(`${beforeDate}T00:00:00`).getTime();
    }

    return null;
  }, [mainMode, timeSubMode, relativeValue, relativeUnit, beforeDate]);

  // 实时匹配将要删除的记录
  const matchedRecords = useMemo(() => {
    if (mainMode === 'all') {
      return records;
    }

    if (cutoffTimestamp !== null) {
      return records.filter((item) => {
        const itemTime = new Date(item.createdAt).getTime();
        return itemTime < cutoffTimestamp;
      });
    }

    return [];
  }, [mainMode, cutoffTimestamp, records]);

  // 统计匹配体积与保留条数
  const matchedBytes = useMemo(() => {
    return matchedRecords.reduce((acc, cur) => acc + (cur.fileSize || 0), 0);
  }, [matchedRecords]);

  const remainCount = records.length - matchedRecords.length;

  // 截止时间的文字描述
  const cutoffDescription = useMemo(() => {
    if (cutoffTimestamp === null) return '';
    const dateObj = new Date(cutoffTimestamp);
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(
      dateObj.getDate()
    ).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(
      dateObj.getMinutes()
    ).padStart(2, '0')}`;
  }, [cutoffTimestamp]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (matchedRecords.length === 0) return;

    try {
      setLoading(true);
      await onConfirm({
        mode: mainMode,
        timeMode: mainMode === 'by_time' ? timeSubMode : undefined,
        relativeValue: mainMode === 'by_time' && timeSubMode === 'relative' ? relativeValue : undefined,
        relativeUnit: mainMode === 'by_time' && timeSubMode === 'relative' ? relativeUnit : undefined,
        beforeDate: mainMode === 'by_time' && timeSubMode === 'before_date' ? beforeDate : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Clear failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col animate-scale-in relative">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute right-5 top-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          title={t('clearModal.close', '关闭')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* 顶部标题栏 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{t('clearModal.title', '清空共享记录')}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('clearModal.subtitle', '当前系统共 {{count}} 条记录，清理后不可恢复', {
                count: records.length,
              })}
            </p>
          </div>
        </div>

        {/* 主模式选择 (全部删除 vs 指定时间删除) */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* 模式 1: 全部删除 */}
          <button
            type="button"
            onClick={() => setMainMode('all')}
            className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
              mainMode === 'all'
                ? 'border-rose-400 bg-rose-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-bold ${mainMode === 'all' ? 'text-rose-700' : 'text-slate-800'}`}>
                {t('clearModal.modeAll', '全部删除')}
              </span>
              <Layers className={`w-4 h-4 ${mainMode === 'all' ? 'text-rose-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {t('clearModal.modeAllDesc', '清空全部历史文件与文本')}
            </p>
          </button>

          {/* 模式 2: 指定时间删除 */}
          <button
            type="button"
            onClick={() => setMainMode('by_time')}
            className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
              mainMode === 'by_time'
                ? 'border-blue-400 bg-blue-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-bold ${mainMode === 'by_time' ? 'text-blue-700' : 'text-slate-800'}`}>
                {t('clearModal.modeByTime', '指定时间删除')}
              </span>
              <Clock className={`w-4 h-4 ${mainMode === 'by_time' ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {t('clearModal.modeByTimeDesc', '按周/月或指定日期清理')}
            </p>
          </button>
        </div>

        {/* 展开“指定时间删除”的配置项 */}
        {mainMode === 'by_time' && (
          <div className="p-4 bg-slate-50/80 border border-slate-200/90 rounded-2xl mb-4 space-y-3.5 animate-fade-in">
            {/* 子选项卡：相对时间 vs 指定年月日 */}
            <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTimeSubMode('relative')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  timeSubMode === 'relative'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('clearModal.subRelative', '删除 x 周/月 前')}
              </button>
              <button
                type="button"
                onClick={() => setTimeSubMode('before_date')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  timeSubMode === 'before_date'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t('clearModal.subBeforeDate', '删除指定年月日之前')}
              </button>
            </div>

            {/* 子模式 1: 相对时间配置 */}
            {timeSubMode === 'relative' && (
              <div className="space-y-3">
                {/* 快捷推荐选择 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESET_PILLS.map((pill) => {
                    const isSelected = relativeValue === pill.value && relativeUnit === pill.unit;
                    return (
                      <button
                        key={`${pill.value}-${pill.unit}`}
                        type="button"
                        onClick={() => {
                          setRelativeValue(pill.value);
                          setRelativeUnit(pill.unit);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {t(pill.key, pill.defaultLabel)}
                      </button>
                    );
                  })}
                </div>

                {/* 自定义输入周/月数 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 shrink-0 font-medium">
                    {t('clearModal.deleteText', '删除')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={relativeValue}
                    onChange={(e) => setRelativeValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 text-center font-mono"
                  />
                  <select
                    value={relativeUnit}
                    onChange={(e) => setRelativeUnit(e.target.value as 'week' | 'month')}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="week">{t('clearModal.unitWeek', '周前 (Weeks)')}</option>
                    <option value="month">{t('clearModal.unitMonth', '个月前 (Months)')}</option>
                  </select>
                  {t('clearModal.recordsOf', '的记录') && (
                    <span className="text-xs text-slate-400">{t('clearModal.recordsOf', '的记录')}</span>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>
                    {t('clearModal.cutoffPrefix', '截止时间：')}
                    {cutoffDescription} {t('clearModal.cutoffSuffix', '之前')}
                  </span>
                </div>
              </div>
            )}

            {/* 子模式 2: 指定年月日配置 */}
            {timeSubMode === 'before_date' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  {t('clearModal.selectDate', '选择指定日期 (该日期 00:00:00 之前创建的记录将被删除)：')}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={beforeDate}
                    onChange={(e) => setBeforeDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>
                    {t('clearModal.willDeleteBefore', '将删除 {{date}} 00:00:00 之前的所有数据', {
                      date: beforeDate,
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 动态影响评估卡片 (实时预览删除数量与体积) */}
        <div
          className={`p-3.5 rounded-2xl border text-xs mb-5 flex items-start gap-2.5 ${
            matchedRecords.length > 0
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          {matchedRecords.length > 0 ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0">
            {matchedRecords.length > 0 ? (
              <>
                <p className="font-bold">
                  {t('clearModal.impactEstimate', '预计将删除 {{count}} 条记录（释放 {{size}} 空间）', {
                    count: matchedRecords.length,
                    size: formatBytes(matchedBytes),
                  })}
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {t('clearModal.impactRemain', '剩余 {{count}} 条较新记录将被保留。', {
                    count: remainCount,
                  })}
                </p>
              </>
            ) : (
              <p className="text-slate-500 font-medium">
                {t('clearModal.noMatch', '当前时间筛选条件下没有符合的记录可清理。')}
              </p>
            )}
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            {t('clearModal.cancel', '取消')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || matchedRecords.length === 0}
            className={`flex-1 py-2.5 rounded-xl text-white text-xs font-semibold shadow-sm transition active:scale-98 flex items-center justify-center gap-1.5 ${
              matchedRecords.length > 0
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200 disabled:opacity-50'
                : 'bg-slate-300 cursor-not-allowed opacity-60'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('clearModal.deleting', '正在清理...')}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>
                  {mainMode === 'all'
                    ? t('clearModal.confirmAll', '确认全部清空 ({{count}} 条)', { count: matchedRecords.length })
                    : t('clearModal.confirmByTime', '确认清理 ({{count}} 条)', {
                        count: matchedRecords.length,
                      })}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

