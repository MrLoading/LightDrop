import React, { useState, useEffect } from 'react';
import { App } from './App';
import { DownloadPasswordPage } from './components/DownloadPasswordPage';

export interface RouteInfo {
  recordId: string;
  mode: 'download' | 'view';
}

function getRouteInfo(): RouteInfo | null {
  if (typeof window === 'undefined') return null;

  const pathname = window.location.pathname;

  // 匹配 /view/:id 格式
  const viewMatch = pathname.match(/^\/view\/([a-zA-Z0-9_-]+)/);
  if (viewMatch && viewMatch[1]) {
    return { recordId: viewMatch[1], mode: 'view' };
  }

  // 匹配 /download/:id 格式
  const downloadMatch = pathname.match(/^\/download\/([a-zA-Z0-9_-]+)/);
  if (downloadMatch && downloadMatch[1]) {
    const params = new URLSearchParams(window.location.search);
    const isView = params.get('mode') === 'view' || params.has('view');
    return { recordId: downloadMatch[1], mode: isView ? 'view' : 'download' };
  }

  // 兼顾兼容 ?view=:id 查询参数
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  if (viewParam) {
    return { recordId: viewParam, mode: 'view' };
  }

  // 兼顾兼容 ?download=:id 查询参数
  const qId = params.get('download');
  if (qId) {
    const isView = params.get('mode') === 'view' || params.has('view');
    return { recordId: qId, mode: isView ? 'view' : 'download' };
  }

  return null;
}

export const Root: React.FC = () => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(() => getRouteInfo());

  useEffect(() => {
    const handlePopState = () => {
      setRouteInfo(getRouteInfo());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (routeInfo) {
    return (
      <DownloadPasswordPage
        recordId={routeInfo.recordId}
        initialMode={routeInfo.mode}
        onBack={() => {
          window.history.pushState({}, '', '/');
          setRouteInfo(null);
        }}
      />
    );
  }

  return <App />;
};
