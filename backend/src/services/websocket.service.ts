// ============================================================
// src/services/websocket.service.ts — Live price push via WS
// ============================================================
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import marketDataService from './marketData.service';

interface ClientState {
  ws: WebSocket;
  subscriptions: Set<string>;
  isAlive: boolean;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientState> = new Map();
  private pricePoller: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30_000;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupServer();
    this.startPricePoller();
    this.startHeartbeat();
    console.log('[WS] WebSocket server initialised on /ws');
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const ip = req.socket.remoteAddress ?? 'unknown';
      console.log(`[WS] Client connected from ${ip}`);

      const state: ClientState = { ws, subscriptions: new Set(), isAlive: true };
      this.clients.set(ws, state);

      // Send welcome handshake
      this.send(ws, { type: 'CONNECTED', message: 'WebSocket connected. Send SUBSCRIBE messages.' });

      ws.on('pong', () => {
        const s = this.clients.get(ws);
        if (s) s.isAlive = true;
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            type: string;
            symbols?: string[];
            symbol?: string;
          };
          this.handleClientMessage(ws, msg);
        } catch {
          this.send(ws, { type: 'ERROR', message: 'Invalid JSON message' });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected from ${ip}`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(
    ws: WebSocket,
    msg: { type: string; symbols?: string[]; symbol?: string }
  ): void {
    const state = this.clients.get(ws);
    if (!state) return;

    switch (msg.type) {
      case 'SUBSCRIBE': {
        const symbols = msg.symbols ?? (msg.symbol ? [msg.symbol] : []);
        symbols.forEach((s) => state.subscriptions.add(s.toUpperCase()));
        this.send(ws, {
          type: 'SUBSCRIBED',
          symbols: Array.from(state.subscriptions),
          message: `Subscribed to ${symbols.join(', ')}. Prices update every 30s.`,
        });
        // Send immediate price on subscribe
        this.pushPricesToClient(ws, state).catch(() => {});
        break;
      }
      case 'UNSUBSCRIBE': {
        const symbols = msg.symbols ?? (msg.symbol ? [msg.symbol] : []);
        symbols.forEach((s) => state.subscriptions.delete(s.toUpperCase()));
        this.send(ws, { type: 'UNSUBSCRIBED', symbols });
        break;
      }
      case 'PING':
        this.send(ws, { type: 'PONG', timestamp: Date.now() });
        break;
      default:
        this.send(ws, { type: 'ERROR', message: `Unknown message type: ${msg.type}` });
    }
  }

  private async pushPricesToClient(ws: WebSocket, state: ClientState): Promise<void> {
    for (const symbol of state.subscriptions) {
      try {
        const price = await marketDataService.getCurrentPrice(symbol);
        this.send(ws, {
          type: 'PRICE_UPDATE',
          symbol,
          price,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        this.send(ws, {
          type: 'PRICE_UNAVAILABLE',
          symbol,
          status: 'DATA_UNAVAILABLE',
          message: (err as Error).message,
        });
      }
    }
  }

  private startPricePoller(): void {
    this.pricePoller = setInterval(async () => {
      for (const [ws, state] of this.clients.entries()) {
        if (ws.readyState === WebSocket.OPEN && state.subscriptions.size > 0) {
          await this.pushPricesToClient(ws, state);
        }
      }
    }, this.POLL_INTERVAL_MS);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [ws, state] of this.clients.entries()) {
        if (!state.isAlive) {
          ws.terminate();
          this.clients.delete(ws);
          return;
        }
        state.isAlive = false;
        ws.ping();
      }
    }, 30_000);
  }

  private send(ws: WebSocket, data: object): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  public broadcastToAll(data: object): void {
    const payload = JSON.stringify(data);
    for (const [ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }

  public shutdown(): void {
    if (this.pricePoller) clearInterval(this.pricePoller);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.wss.close();
  }
}

export default WebSocketService;
