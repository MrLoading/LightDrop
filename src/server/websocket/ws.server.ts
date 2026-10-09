import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { WsEventType, WsMessage } from '../../shared/types.js';

export class WsService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  public init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.clients.add(ws);
      this.broadcastOnlineCount();

      // 定期保活 Ping-Pong
      (ws as any).isAlive = true;
      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.broadcastOnlineCount();
      });

      ws.on('error', (err) => {
        console.warn('[WebSocket] Client error:', err);
        this.clients.delete(ws);
        this.broadcastOnlineCount();
      });
    });

    // 30 秒心跳检测
    const interval = setInterval(() => {
      this.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          this.clients.delete(ws);
          return ws.terminate();
        }
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  public getOnlineCount(): number {
    return this.clients.size;
  }

  public broadcast<T = any>(type: WsEventType, payload: T): void {
    const message: WsMessage<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (e) {
          console.warn('[WebSocket] Send failed:', e);
        }
      }
    });
  }

  public broadcastOnlineCount(): void {
    this.broadcast('ONLINE_COUNT_CHANGED', {
      onlineUsers: this.getOnlineCount(),
    });
  }
}

export const wsService = new WsService();
