import React, { useState, useEffect } from 'react';
import { App } from './App';
import { DownloadPasswordPage } from './components/DownloadPasswordPage';

function getDownloadRecordId(): string | null {
  if (typeof window === 'undefined') return null;

  // 匹配 /download/:id 格式
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/download\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // 兼顾兼容 ?download=:id 查询参数
  const params = new URLSearchParams(window.location.search);
  const qId = params.get('download');
  if (qId) {
    return qId;
  }

  return null;
}

export const Root: React.FC = () => {
  const [downloadRecordId, setDownloadRecordId] = useState<string | null>(() => getDownloadRecordId());

  useEffect(() => {
    const handlePopState = () => {
      setDownloadRecordId(getDownloadRecordId());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (downloadRecordId) {
    return (
      <DownloadPasswordPage
        recordId={downloadRecordId}
        onBack={() => {
          window.history.pushState({}, '', '/');
          setDownloadRecordId(null);
        }}
      />
    );
  }

  return <App />;
};
