import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import { Root } from './Root';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// 自动更新 Service Worker
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New content available, reload to update.');
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline caching.');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
