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
  const [showChartOnMobile, setShowChartOnMobile] = useState(true);

  // Interval in seconds: 1min = 60s, 5min = 300s, 15min = 900s
  const intervalSeconds = selectedInterval === '1min' ? 60 : selectedInterval === '15min' ? 900 : 300;

  const [secondsUntilNextCandle, setSecondsUntilNextCandle] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return intervalSeconds - (now % intervalSeconds);
  });
  const [isUpdatingCandle, setIsUpdatingCandle] = useState(false);

  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const fetchCandles = useCallback(async () => {
    try {
      const result = await api.getCandles(selectedSymbol, selectedInterval);

      // Handle DATA_UNAVAILABLE sentinel
      if (result && !Array.isArray(result) && (result as any).status === 'DATA_UNAVAILABLE') {
        setDataAvailable(false);
        setConnectionStatus('error');
        return;
      }

      const rawArr: any[] = Array.isArray(result)
        ? result
        : (Array.isArray((result as any)?.candles) ? (result as any).candles : []);
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
        setDataAvailable(true);
        setConnectionStatus('connected');
      } else {
        setDataAvailable(false);
        setConnectionStatus('error');
      }
    } catch {
      setDataAvailable(false);
      setConnectionStatus('error');
    }
  }, [selectedSymbol, selectedInterval, setCandles, setCurrentPrice, setDataAvailable, setConnectionStatus]);

  const analyzeSignal = useCallback(async () => {
    const currentCandles = candlesRef.current;
    if (!dataAvailable || currentCandles.length < 20) return;
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

  // Initial fetch and quiet price polling every 30s (does NOT disrupt UI or re-analyze)
  useEffect(() => {
    fetchCandles();
    const id = setInterval(fetchCandles, 30_000);
    return () => clearInterval(id);
  }, [fetchCandles]);

  // Initial analysis when candles load or symbol changes
  useEffect(() => {
    if (candles.length >= 50 && dataAvailable) {
      analyzeSignal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, selectedInterval]);

  // ⏰ Exact Candle Boundary Synchronization:
  // Auto-refresh triggers ONLY when a new candle begins (e.g. at the 5-minute mark),
  // exactly when CALL / PUT / WAIT signal needs to be refreshed for the fresh candle!
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = intervalSeconds - (now % intervalSeconds);
      setSecondsUntilNextCandle(remaining);

      // Trigger automatic re-analysis precisely when the new candle opens (remaining === intervalSeconds)
      if (remaining === intervalSeconds && autoRefresh && dataAvailable) {
        setIsUpdatingCandle(true);
        fetchCandles().then(() => {
          analyzeSignal().finally(() => {
            setIsUpdatingCandle(false);
          });
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSeconds, autoRefresh, dataAvailable, fetchCandles, analyzeSignal]);

  const lastUpdated = candles.length
    ? new Date(candles[candles.length - 1].time * 1000).toLocaleTimeString()
    : '---';

  return (
    <div className="flex flex-col h-full gap-2.5 sm:gap-4 p-2 sm:p-4 max-w-7xl mx-auto w-full">
      {/* Top bar — Mobile Optimized & Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-900/60 p-2 sm:p-3 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2 flex-wrap">
          <AssetSelector />
          <TimeframeSelector />

          {/* Auto-Refresh Candle Sync Button */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-gray-800/80 border-gray-700 text-gray-400'
            }`}
            title="Auto-refresh AI signal only when next candle opens"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
            <span className="font-mono">
              {isUpdatingCandle
                ? '⚡ New Candle...'
                : autoRefresh
                ? `Next: ${formatTime(secondsUntilNextCandle)}`
                : 'Auto: OFF'}
            </span>
          </button>

          {/* Mobile Chart Visibility Toggle */}
          <button
            onClick={() => setShowChartOnMobile(!showChartOnMobile)}
            className="sm:hidden flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-300 font-medium"
            title="Toggle chart on small screen"
          >
            <span>{showChartOnMobile ? '👁️ Chart' : '📊 Chart'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-800/60">
          <PriceTicker />
          <div className="flex items-center gap-2">
            <StatusBadge status={connectionStatus} />
            <span className="text-gray-500 text-[11px] hidden md:inline">Synced {lastUpdated}</span>
          </div>
        </div>
      </div>

      <RiskWarning />

      {/* DATA UNAVAILABLE banner */}
      {!dataAvailable && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-gray-900 border border-yellow-800 rounded-xl p-4 text-center">
          <div className="text-4xl sm:text-5xl">⚠️</div>
          <p className="text-yellow-400 font-bold text-lg sm:text-xl">DATA UNAVAILABLE</p>
          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
            Live market data is currently reconnecting. Signals resume once feed is active.
          </p>
          <button
            onClick={fetchCandles}
            className="mt-2 px-4 py-2 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg text-xs sm:text-sm hover:bg-yellow-800/50 transition-colors font-bold"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main grid */}
      {dataAvailable && (
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 flex-1 min-h-0">
          {/* Chart — Responsive & Collapsible on Mobile */}
          {showChartOnMobile && (
            <div className="w-full lg:w-3/5 min-h-[220px] sm:min-h-[380px] flex flex-col">
              {candles.length > 0 ? (
                <CandlestickChart />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 flex items-center justify-center p-6 min-h-[220px]">
                  <div className="flex flex-col items-center gap-3">
                    <LoadingSpinner />
                    <p className="text-gray-500 text-xs sm:text-sm">Loading market candles…</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Signal panel — 40% Desktop / Full on Mobile */}
          <div className="w-full lg:w-2/5 flex flex-col gap-2.5 sm:gap-3">
            <SignalCard signal={currentSignal} isAnalyzing={isAnalyzing} />

            {currentSignal && !isAnalyzing && (
              <>
                <button
                  onClick={analyzeSignal}
                  className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
                >
                  ⚡ Re-analyze Market Now
                </button>
                <ReasonsList reasons={currentSignal.reasons} />
                <IndicatorPanel indicators={currentSignal.indicators} />
              </>
            )}

            {!isAnalyzing && !currentSignal && candles.length >= 50 && (
              <button
                onClick={analyzeSignal}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] text-sm"
              >
                ⚡ Generate AI Signal
              </button>
            )}

            {!isAnalyzing && candles.length > 0 && candles.length < 50 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-xs sm:text-sm">
                  Accumulating market candles… ({candles.length}/50 loaded)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual refresh footer */}
      {dataAvailable && (
        <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 pt-1">
          <span>Signal Interval: {selectedInterval}</span>
          <button
            onClick={fetchCandles}
            className="hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload Candles
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
