import { useEffect, useRef, useState, useCallback } from 'react';
import { WsMessage } from '@shared/types';

export function useWebSocket(onMessageReceived?: (msg: WsMessage) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 用 ref 保存最新的消息回调函数，彻底防止因依赖变更导致的无效重连与连接抖动
  const callbackRef = useRef(onMessageReceived);
  useEffect(() => {
    callbackRef.current = onMessageReceived;
  }, [onMessageReceived]);

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WsMessage = JSON.parse(event.data);
          if (data.type === 'ONLINE_COUNT_CHANGED' && data.payload?.onlineUsers) {
            setOnlineCount(data.payload.onlineUsers);
          }
          if (callbackRef.current) {
            callbackRef.current(data);
          }
        } catch (e) {
          console.warn('[WS] Parse message error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        // 快速自动重连 (1.5 秒)
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 1500);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch (_) {}
      };
    } catch (e) {
      console.warn('[WS] Connection init error:', e);
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 2000);
      }
    }
  }, []);

  useEffect(() => {
    connect();

    // 移动端锁屏/切换前后台唤醒时，主动检查并快速恢复长连接
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', connect);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', connect);

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (_) {}
      }
    };
  }, [connect]);

  return { isConnected, onlineCount };
}
