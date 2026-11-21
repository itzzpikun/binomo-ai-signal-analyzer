import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import type { WebSocketMessage } from '../types';

const getWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }
  return 'ws://localhost:5001';
};

const RECONNECT_DELAY_MS = 5000;

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const setCurrentPrice = useAppStore((s) => s.setCurrentPrice);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(`${wsUrl}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus('connected');

        // Subscribe to current symbol
        ws.send(
          JSON.stringify({ type: 'subscribe', symbol: selectedSymbol })
        );
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const msg: WebSocketMessage = JSON.parse(event.data as string);
          if (msg.type === 'price_update' && msg.data) {
            const data = msg.data as { symbol: string; price: number; timestamp: string };
            if (data.symbol === selectedSymbol) {
              setCurrentPrice(data.price);
            }
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Schedule reconnect
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      };
    } catch {
      setConnectionStatus('error');
    }
  }, [selectedSymbol, setConnectionStatus, setCurrentPrice]);

  // Subscribe to new symbol when it changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'subscribe', symbol: selectedSymbol })
      );
    }
  }, [selectedSymbol]);

  // Initial connection
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { sendMessage };
};
