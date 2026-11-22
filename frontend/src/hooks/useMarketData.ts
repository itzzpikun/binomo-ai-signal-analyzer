import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { getCandles, getCurrentPrice } from '../services/api';
import type { Candle } from '../types';

// Refresh interval set to 10 seconds for both price and candles
const REFRESH_INTERVAL_MS = 10000; // 10 seconds

export const useMarketData = () => {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const selectedInterval = useAppStore((s) => s.selectedInterval);
  const setCandles = useAppStore((s) => s.setCandles);
  const setCurrentPrice = useAppStore((s) => s.setCurrentPrice);
  const setDataAvailable = useAppStore((s) => s.setDataAvailable);

  const priceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const candlesTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchCandles = useCallback(async () => {
    try {
      const response = await getCandles(selectedSymbol, selectedInterval);
      if (!isMountedRef.current) return;

      if (response.status === 'DATA_UNAVAILABLE' || !response.candles?.length) {
        setDataAvailable(false);
        setCandles([]);
      } else {
        const mapped: Candle[] = response.candles
          .map((c: any) => ({
            time: Math.floor(
              new Date(
                c.datetime || c.timestamp || (c.time ? c.time * 1000 : Date.now())
              ).getTime() / 1000
            ),
            timestamp:
              c.timestamp ||
              c.datetime ||
              (c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString()),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            volume: c.volume ? parseFloat(c.volume) : undefined,
          }))
          .filter((c: Candle) => !isNaN(c.time) && !isNaN(c.close));

        mapped.sort((a, b) => a.time - b.time);

        setDataAvailable(true);
        setCandles(mapped);
      }
    } catch {
      if (!isMountedRef.current) return;
      setDataAvailable(false);
      setCandles([]);
    }
  }, [selectedSymbol, selectedInterval, setCandles, setDataAvailable]);

  const fetchPrice = useCallback(async () => {
    try {
      const response = await getCurrentPrice(selectedSymbol);
      if (!isMountedRef.current) return;
      setCurrentPrice(response.price);
    } catch {
      if (!isMountedRef.current) return;
      setCurrentPrice(null);
    }
  }, [selectedSymbol, setCurrentPrice]);

  // Initial fetch and periodic refresh for candles
  useEffect(() => {
    isMountedRef.current = true;
    fetchCandles();
    candlesTimerRef.current = setInterval(fetchCandles, REFRESH_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      if (candlesTimerRef.current) clearInterval(candlesTimerRef.current);
    };
  }, [fetchCandles]);

  // Initial fetch and periodic refresh for price
  useEffect(() => {
    fetchPrice();
    priceTimerRef.current = setInterval(fetchPrice, REFRESH_INTERVAL_MS);
    return () => {
      if (priceTimerRef.current) clearInterval(priceTimerRef.current);
    };
  }, [fetchPrice]);

  return { fetchCandles, fetchPrice };
};
