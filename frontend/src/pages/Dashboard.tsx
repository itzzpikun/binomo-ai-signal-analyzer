import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../services/api';
import CandlestickChart from '../components/charts/CandlestickChart';
import SignalCard from '../components/signal/SignalCard';
import IndicatorPanel from '../components/signal/IndicatorPanel';
import ReasonsList from '../components/signal/ReasonsList';
import AssetSelector from '../components/market/AssetSelector';
import TimeframeSelector from '../components/market/TimeframeSelector';
import PriceTicker from '../components/market/PriceTicker';
import StatusBadge from '../components/common/StatusBadge';
import RiskWarning from '../components/common/RiskWarning';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Candle } from '../types';

const Dashboard: React.FC = () => {
  const {
    selectedSymbol, selectedInterval,
    candles, currentSignal,
    dataAvailable, isAnalyzing,
    connectionStatus,
    setCandles, setCurrentPrice, setDataAvailable,
    setCurrentSignal, setIsAnalyzing, setConnectionStatus,
  } = useAppStore();

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdownSec, setCountdownSec] = useState(5);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const fetchCandles = useCallback(async () => {
    try {
      const result = await api.getCandles(selectedSymbol, selectedInterval);

      // Handle DATA_UNAVAILABLE sentinel
      if (result && !Array.isArray(result) && (result as any).status === 'DATA_UNAVAILABLE') {
        setDataAvailable(false);
        setConnectionStatus('error');
        return;
      }

      const rawArr: any[] = Array.isArray(result) ? result : [];
      const mapped: Candle[] = rawArr.map((c: any) => ({
        time: Math.floor(new Date(c.datetime || c.timestamp || c.time).getTime() / 1000),
        timestamp: c.datetime || c.timestamp || (c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString()),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: c.volume ? parseFloat(c.volume) : undefined,
      })).filter((c: Candle) => !isNaN(c.time) && !isNaN(c.close));

      mapped.sort((a, b) => a.time - b.time);
      setCandles(mapped);
      if (mapped.length > 0) {
        setCurrentPrice(mapped[mapped.length - 1].close);
      }
      setDataAvailable(true);
      setConnectionStatus('connected');
    } catch {
      setDataAvailable(false);
      setConnectionStatus('error');
    }
  }, [selectedSymbol, selectedInterval, setCandles, setCurrentPrice, setDataAvailable, setConnectionStatus]);

  const analyzeSignal = useCallback(async () => {
    const currentCandles = candlesRef.current;
    if (!dataAvailable || currentCandles.length < 50) return;
    setIsAnalyzing(true);
    try {
      const result = await api.analyzeSignal(selectedSymbol, selectedInterval, currentCandles);
      setCurrentSignal(result);
    } catch (err) {
      console.error('[Analyze Signal Error]:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [dataAvailable, selectedSymbol, selectedInterval, setIsAnalyzing, setCurrentSignal]);

  // Fetch candles on symbol/interval change with 10s live pulse
  useEffect(() => {
    fetchCandles();
    const id = setInterval(fetchCandles, 10_000);
    return () => clearInterval(id);
  }, [fetchCandles]);

  // Initial analysis when candles load
  useEffect(() => {
    if (candles.length >= 50 && dataAvailable) {
      analyzeSignal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles.length, selectedSymbol]);

  // 1-second auto-refresh countdown loop
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdownSec((prev) => {
        if (prev <= 1) {
          if (candlesRef.current.length >= 50 && dataAvailable && !isAnalyzing) {
            analyzeSignal();
          }
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, dataAvailable, isAnalyzing, analyzeSignal]);

  const lastUpdated = candles.length
    ? new Date(candles[candles.length - 1].time * 1000).toLocaleTimeString()
    : '---';

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4 p-2.5 sm:p-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <AssetSelector />
          <TimeframeSelector />
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-gray-800/80 border-gray-700 text-gray-400'
            }`}
            title="Auto-refresh AI signal analysis every second"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
            <span>Auto-Refresh: {autoRefresh ? `ON (${countdownSec}s)` : 'OFF'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <PriceTicker />
          <StatusBadge status={connectionStatus} />
          <span className="text-gray-500 text-xs hidden lg:block">Updated {lastUpdated}</span>
        </div>
      </div>

      <RiskWarning />

      {/* DATA UNAVAILABLE banner */}
      {!dataAvailable && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-gray-900 border border-yellow-800 rounded-xl">
          <div className="text-5xl">⚠️</div>
          <p className="text-yellow-400 font-bold text-xl">DATA UNAVAILABLE</p>
          <p className="text-gray-400 text-sm text-center max-w-sm px-4">
            Live market data is currently unavailable. Signals disabled until connection is restored.
          </p>
          <button
            onClick={fetchCandles}
            className="mt-2 px-4 py-2 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg text-sm hover:bg-yellow-800/50 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main grid */}
      {dataAvailable && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* Chart — 60% */}
          <div className="lg:w-3/5 min-h-[300px] sm:min-h-[420px] flex flex-col">
            {candles.length > 0 ? (
              <CandlestickChart />
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <LoadingSpinner />
                  <p className="text-gray-500 text-sm">Loading market data…</p>
                </div>
              </div>
            )}
          </div>

          {/* Signal panel — 40% */}
          <div className="lg:w-2/5 flex flex-col gap-3">
            <SignalCard signal={currentSignal} isAnalyzing={isAnalyzing} />

            {currentSignal && !isAnalyzing && (
              <>
                <button
                  onClick={analyzeSignal}
                  className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  ⚡ Re-analyze Market
                </button>
                <ReasonsList reasons={currentSignal.reasons} />
                <IndicatorPanel indicators={currentSignal.indicators} />
              </>
            )}

            {!isAnalyzing && !currentSignal && candles.length >= 50 && (
              <button
                onClick={analyzeSignal}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                ⚡ Analyze Now
              </button>
            )}

            {!isAnalyzing && candles.length > 0 && candles.length < 50 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm">
                  Loading candles… ({candles.length}/50 needed for analysis)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual refresh */}
      {dataAvailable && (
        <div className="flex justify-end">
          <button
            onClick={fetchCandles}
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh data
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
