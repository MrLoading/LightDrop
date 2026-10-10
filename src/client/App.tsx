import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from './components/Header';
import { SendCard } from './components/SendCard';
import { QuickPreviewCard } from './components/QuickPreviewCard';
import { RecordsTable } from './components/RecordsTable';
import { Footer } from './components/Footer';
import { SettingsModal } from './components/SettingsModal';
import { QrCodeModal } from './components/QrCodeModal';
import { useRecords } from './hooks/useRecords';
import { useWebSocket } from './hooks/useWebSocket';
import { WsMessage } from '@shared/types';

export const App: React.FC = () => {
  const { t } = useTranslation();
  const {
    records,
    filteredRecords,
    stats,
    accessUrl,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    sendText,
    uploadFiles,
    uploadFolder,
    uploadMixedBatch,
    copyRecordContent,
    copyShareLink,
    downloadRecord,
    deleteRecord,
    deleteBatch,
    clearAllRecords,
    fetchRecords,
    fetchStats,
    verifyPassword,
    latestText,
    latestFile,
  } = useRecords();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [incomingToast, setIncomingToast] = useState<string | null>(null);

  // 默认访问 IP 持久化缓存到当前浏览器 localStorage
  const PREFERRED_IP_KEY = 'lightdrop_preferred_ip_url';
  const [selectedAccessUrl, setSelectedAccessUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(PREFERRED_IP_KEY) || '';
    } catch {
      return '';
    }
  });

  const handleSelectDefaultUrl = useCallback((url: string) => {
    setSelectedAccessUrl(url);
    try {
      localStorage.setItem(PREFERRED_IP_KEY, url);
    } catch (_) {}
  }, []);

  // 校验并同步缓存的默认 IP
  useEffect(() => {
    if (stats.ipList && stats.ipList.length > 0) {
      try {
        const cached = localStorage.getItem(PREFERRED_IP_KEY);
        if (cached) {
          const matched = stats.ipList.find(
            (item) => cached === item.url || cached.includes(item.ip)
          );
          if (matched) {
            setSelectedAccessUrl(matched.url);
            return;
          }
        }
        const defaultItem = stats.ipList.find((item) => item.isDefault) || stats.ipList[0];
        if (defaultItem) {
          setSelectedAccessUrl(defaultItem.url);
          localStorage.setItem(PREFERRED_IP_KEY, defaultItem.url);
        }
      } catch (_) {}
    }
  }, [stats.ipList]);

  const activeUrl = selectedAccessUrl || accessUrl;

  // 接收 WebSocket 广播消息，实时长连接推送
  const handleWsMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === 'ITEM_CREATED') {
        fetchRecords();
        fetchStats();
        if (msg.payload?.title) {
          setIncomingToast(t('app.incomingToast', { title: msg.payload.title }));
          setTimeout(() => setIncomingToast(null), 3500);
        }
      } else if (
        msg.type === 'ITEM_DELETED' ||
        msg.type === 'ITEMS_BATCH_DELETED' ||
        msg.type === 'ITEMS_CLEARED'
      ) {
        fetchRecords();
        fetchStats();
      } else if (msg.type === 'SETTINGS_UPDATED' || msg.type === 'STATS_UPDATED') {
        fetchStats();
      }
    },
    [fetchRecords, fetchStats]
  );

  const { isConnected, onlineCount } = useWebSocket(handleWsMessage);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchRecords(), fetchStats()]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const scrollToRecords = () => {
    const el = document.getElementById('records-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f9] p-3 sm:p-6 lg:p-8 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900 relative">
      {/* 局域网主动推送悬浮提示 */}
      {incomingToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xl border border-slate-700/60 flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{incomingToast}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto w-full">
        {/* 顶部 Header */}
        <Header
          accessUrl={accessUrl}
          currentUrl={activeUrl}
          ipList={stats.ipList || []}
          onSelectUrl={handleSelectDefaultUrl}
          onRefresh={handleRefresh}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenQrCode={() => setQrCodeOpen(true)}
          isRefreshing={isRefreshing}
          isConnected={isConnected}
        />

        {/* 上半部分：左侧发送内容，右侧快速预览与统计 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5 items-stretch">
          {/* 左侧发送卡片 (占 7 列) */}
          <div className="lg:col-span-7 flex flex-col">
            <SendCard
              onSendText={sendText}
              onUploadFiles={uploadFiles}
              onUploadFolder={uploadFolder}
              onUploadMixedBatch={uploadMixedBatch}
            />
          </div>

          {/* 右侧快速预览与统计卡片 (占 5 列) */}
          <div className="lg:col-span-5 flex flex-col">
            <QuickPreviewCard
              recentRecords={records.slice(0, 3)}
              stats={stats}
              onScrollToRecords={scrollToRecords}
              onCopyText={copyRecordContent}
              onDownloadFile={downloadRecord}
              verifyPassword={verifyPassword}
            />
          </div>
        </div>

        {/* 下半部分：共享记录表格卡片 */}
        <RecordsTable
          records={filteredRecords}
          stats={stats}
          currentAccessUrl={activeUrl}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          toggleSelectAll={toggleSelectAll}
          onCopyText={copyRecordContent}
          onDownload={downloadRecord}
          onDeleteOne={deleteRecord}
          onBatchDelete={deleteBatch}
          onClearAll={clearAllRecords}
          verifyPassword={verifyPassword}
          onCopyShareLink={copyShareLink}
        />

        {/* 底部状态栏 */}
        <Footer stats={stats} onlineCount={onlineCount} />
      </div>

      {/* 设置中心弹窗 */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsSaved={() => {
          fetchRecords();
          fetchStats();
        }}
      />

      {/* 手机扫码访问弹窗 (支持多网卡IP选择) */}
      <QrCodeModal
        isOpen={qrCodeOpen}
        onClose={() => setQrCodeOpen(false)}
        accessUrl={activeUrl}
        ipList={stats.ipList || []}
        onSelectUrl={handleSelectDefaultUrl}
      />
    </div>
  );
};
