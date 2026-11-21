import { useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { getCandles, getCurrentPrice } from '../services/api';

const PRICE_POLL_INTERVAL_MS = 30000; // 30 seconds

export const useMarketData = () => {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const selectedInterval = useAppStore((s) => s.selectedInterval);
  const setCandles = useAppStore((s) => s.setCandles);
  const setCurrentPrice = useAppStore((s) => s.setCurrentPrice);
  const setDataAvailable = useAppStore((s) => s.setDataAvailable);

  const priceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchCandles = useCallback(async () => {
    try {
      const response = await getCandles(selectedSymbol, selectedInterval);
      if (!isMountedRef.current) return;

      if (response.status === 'DATA_UNAVAILABLE' || !response.candles?.length) {
        setDataAvailable(false);
        setCandles([]);
      } else {
        setDataAvailable(true);
        setCandles(response.candles);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const error = err as { status?: string };
      if (error?.status === 'DATA_UNAVAILABLE') {
        setDataAvailable(false);
      } else {
        setDataAvailable(false);
      }
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

  // Fetch candles when symbol or interval changes
  useEffect(() => {
    isMountedRef.current = true;
    fetchCandles();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchCandles]);

  // Poll price every 30 seconds
  useEffect(() => {
    fetchPrice();
    priceTimerRef.current = setInterval(fetchPrice, PRICE_POLL_INTERVAL_MS);
    return () => {
      if (priceTimerRef.current) clearInterval(priceTimerRef.current);
    };
  }, [fetchPrice]);

  return { fetchCandles, fetchPrice };
};
