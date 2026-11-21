import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { analyzeSignal } from '../services/api';

export const useSignal = () => {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const selectedInterval = useAppStore((s) => s.selectedInterval);
  const candles = useAppStore((s) => s.candles);
  const dataAvailable = useAppStore((s) => s.dataAvailable);
  const setCurrentSignal = useAppStore((s) => s.setCurrentSignal);
  const setIsAnalyzing = useAppStore((s) => s.setIsAnalyzing);
  const isAnalyzing = useAppStore((s) => s.isAnalyzing);

  const analyze = useCallback(async () => {
    if (!dataAvailable || !candles.length || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const signal = await analyzeSignal({
        symbol: selectedSymbol,
        interval: selectedInterval,
        candles,
      });
      setCurrentSignal(signal);
    } catch (err) {
      console.error('Signal analysis failed:', err);
      setCurrentSignal(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    dataAvailable,
    candles,
    isAnalyzing,
    selectedSymbol,
    selectedInterval,
    setCurrentSignal,
    setIsAnalyzing,
  ]);

  return { analyze };
};
