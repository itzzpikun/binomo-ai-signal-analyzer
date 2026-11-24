import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { api, type MultiAssetSignal } from '../services/api';
import CandlestickChart from '../components/charts/CandlestickChart';
import SignalCard from '../components/signal/SignalCard';
import IndicatorPanel from '../components/signal/IndicatorPanel';
import ReasonsList from '../components/signal/ReasonsList';
import { BinomoTradePanel } from '../components/signal/BinomoTradePanel';
import AssetSelector from '../components/market/AssetSelector';
import TimeframeSelector from '../components/market/TimeframeSelector';
import PriceTicker from '../components/market/PriceTicker';
import StatusBadge from '../components/common/StatusBadge';
import RiskWarning from '../components/common/RiskWarning';
import LoadingSpinner from '../components/common/LoadingSpinner';
import SignalNotificationBanner from '../components/common/SignalNotificationBanner';
import TradeTimingCountdown from '../components/signal/TradeTimingCountdown';
import type { Candle, Signal } from '../types';

const Dashboard: React.FC = () => {
  const {
    selectedSymbol,
    selectedInterval,
    candles,
    currentSignal,
    dataAvailable,
    isAnalyzing,
    connectionStatus,
    setCandles,
    setCurrentPrice,
    setDataAvailable,
    setCurrentSignal,
    setIsAnalyzing,
    setConnectionStatus,
    setSelectedSymbol,
  } = useAppStore();

  const [multiAssetSignals, setMultiAssetSignals] = useState<MultiAssetSignal[]>([]);
  const [showChartOnMobile, setShowChartOnMobile] = useState(true);

  // Interval in seconds: 1min = 60s, 5min = 300s, 15min = 900s
  const intervalSeconds =
    selectedInterval === '1min' ? 60 : selectedInterval === '15min' ? 900 : 300;

  const [secondsUntilNextCandle, setSecondsUntilNextCandle] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return intervalSeconds - (now % intervalSeconds);
  });

  const isMountedRef = useRef(true);
  const isAnalyzingRef = useRef(false);
  const activeSignalRef = useRef<Signal | null>(null);
  const currentSlotRef = useRef<number>(0);

  // Reset lock when symbol or interval changes
  useEffect(() => {
    activeSignalRef.current = null;
    currentSlotRef.current = 0;
  }, [selectedSymbol, selectedInterval]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Analyze signal using the latest candle data with Candle-Slot Locking
  const analyzeSignal = useCallback(
    async (candlesToAnalyze: Candle[]) => {
      if (!candlesToAnalyze || candlesToAnalyze.length < 3) return;
      if (isAnalyzingRef.current) return;

      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      try {
        const result = await api.analyzeSignal(
          selectedSymbol,
          selectedInterval,
          candlesToAnalyze
        );
        if (result && isMountedRef.current) {
          const now = Date.now();
          const slot = Math.floor(now / 1000 / intervalSeconds) * intervalSeconds;

          // Candle-Slot Locking: Once decided for this candle slot, keep the direction locked
          if (activeSignalRef.current && currentSlotRef.current === slot) {
            const lockedDirection = activeSignalRef.current.direction;
            const updated: Signal = {
              ...result,
              direction: lockedDirection,
              confidence: Math.max(result.confidence, activeSignalRef.current.confidence),
              trade_quality: activeSignalRef.current.trade_quality || result.trade_quality,
            };
            activeSignalRef.current = updated;
            setCurrentSignal(updated);
          } else {
            // New candle slot: adopt and lock in the fresh signal!
            currentSlotRef.current = slot;
            activeSignalRef.current = result;
            setCurrentSignal(result);
          }
        }
      } catch (err) {
        console.error('[Auto Signal Error]:', err);
        // Strict Data Integrity (Phase 1 Requirement 6): Return WAIT with DATA_UNAVAILABLE when feed is reconnecting
        if (isMountedRef.current && !activeSignalRef.current) {
          const waitSignal: Signal = {
            id: 'wait_feed_reconnecting_' + Date.now(),
            symbol: selectedSymbol,
            interval: selectedInterval,
            timestamp: new Date().toISOString(),
            direction: 'WAIT',
            confidence: 0,
            trade_quality: 'DATA_UNAVAILABLE',
            confluence_score: 0,
            next_probable_setup: {
              bias: 'CALL',
              biasPercentage: 50,
              bullishPower: 50,
              bearishPower: 50,
              watchTrigger: 'Reconnecting to verified market feed. Signal generation paused.',
              setupSummary: 'Live market feed reconnecting. No trades generated to protect capital.',
            },
            entry_timing: {
              rule_en: 'Feed reconnecting. DO NOT trade until genuine verified data is live.',
              rule_hi: 'Market data reconnect ho raha hai. Fake trade se bachne ke liye WAIT karein.',
              recommended_action: 'WAIT - Do not enter trade',
              entry_window: 'None (Data Unavailable)',
              expiry_duration: selectedInterval,
              confluence_count: 0,
              quality_tier: 'WAIT (DATA_UNAVAILABLE)',
              quality_label: 'Awaiting Genuine Feed',
            },
            indicators: {
              rsi: { value: 50, signal: 'neutral' },
              macd: { macd: 0, signal_line: 0, histogram: 0, crossover: 'neutral' },
              ema: { trend: 'neutral' },
            },
            reasons: {
              bullish: [],
              bearish: [],
            },
            data_quality: {
              isValid: false,
              feedStatus: 'DATA_UNAVAILABLE',
              message: 'Connecting to market feed...',
              source: 'Binance / Twelve Data',
              candleCount: candlesToAnalyze ? candlesToAnalyze.length : 0,
              duplicateCount: 0,
              latencySeconds: 0,
              lastCandleTimestamp: null,
              anomaliesDetected: ['FEED_RECONNECTING'],
            },
          };
          activeSignalRef.current = waitSignal;
          setCurrentSignal(waitSignal);
        }
      } finally {
        isAnalyzingRef.current = false;
        if (isMountedRef.current) {
          setIsAnalyzing(false);
        }
      }
    },
    [selectedSymbol, selectedInterval, intervalSeconds, setIsAnalyzing, setCurrentSignal]
  );

  // Fetch candles & current price, then immediately analyze signal
  const fetchMarketDataAndAnalyze = useCallback(async () => {
    try {
      // 1. Fetch latest candles
      const result = await api.getCandles(selectedSymbol, selectedInterval);
      if (!isMountedRef.current) return;

      if (
        result &&
        !Array.isArray(result) &&
        (result as any).status === 'DATA_UNAVAILABLE'
      ) {
        setDataAvailable(false);
        setConnectionStatus('error');
        return;
      }

      const rawArr: any[] = Array.isArray(result)
        ? result
        : Array.isArray((result as any)?.candles)
        ? (result as any).candles
        : [];

      const mapped: Candle[] = rawArr
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

      if (mapped.length > 0) {
        const latestPrice = mapped[mapped.length - 1].close;
        setCandles(mapped);
        setCurrentPrice(latestPrice);
        setDataAvailable(true);
        setConnectionStatus('connected');

        // Immediately analyze signal with full engine!
        analyzeSignal(mapped);
      } else {
        setDataAvailable(false);
        setConnectionStatus('error');
      }

      // 2. Also fetch latest tick price
      try {
        const priceRes = await api.getCurrentPrice(selectedSymbol);
        if (priceRes && typeof priceRes.price === 'number' && isMountedRef.current) {
          setCurrentPrice(priceRes.price);
        }
      } catch {
        // Fallback to candle close already set
      }
    } catch {
      if (isMountedRef.current) {
        setDataAvailable(false);
        setConnectionStatus('error');
      }
    }
  }, [
    selectedSymbol,
    selectedInterval,
    setCandles,
    setCurrentPrice,
    setDataAvailable,
    setConnectionStatus,
    analyzeSignal,
  ]);

  // Initial fetch on mount / symbol change + continuous 10s automatic live refresh
  useEffect(() => {
    isMountedRef.current = true;
    fetchMarketDataAndAnalyze();

    const intervalId = setInterval(() => {
      fetchMarketDataAndAnalyze();
    }, 10_000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [fetchMarketDataAndAnalyze]);

  // Background Multi-Asset Scanner: Scans all 26 Binomo markets every 15s
  useEffect(() => {
    let isMounted = true;
    const runScan = async () => {
      try {
        const res = await api.scanAllAssets(selectedInterval);
        if (isMounted && res && Array.isArray(res.signals)) {
          setMultiAssetSignals(res.signals);
        }
      } catch {
        // scan error handled silently
      }
    };

    runScan();
    const scanInterval = setInterval(runScan, 15_000);
    return () => {
      isMounted = false;
      clearInterval(scanInterval);
    };
  }, [selectedInterval]);

  // Candle close countdown clock (updates every 1s)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setSecondsUntilNextCandle(intervalSeconds - (now % intervalSeconds));
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSeconds]);

  const lastUpdated = candles.length
    ? new Date(candles[candles.length - 1].time * 1000).toLocaleTimeString()
    : '---';

  return (
    <div className="flex flex-col h-full gap-2.5 sm:gap-4 p-2 sm:p-4 max-w-7xl mx-auto w-full">
      {/* High-visibility Live Signal Notification Banner with Instant Trade Button & Sound across ALL markets */}
      <SignalNotificationBanner
        currentSignal={currentSignal}
        multiSignals={multiAssetSignals}
        onSelectAsset={(symbol) => setSelectedSymbol(symbol)}
      />

      {/* Top bar — Mobile Optimized & Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-900/60 p-2 sm:p-3 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2 flex-wrap">
          <AssetSelector />
          <TimeframeSelector />

          {/* Automatic Live 10s Sync Indicator — No manual button needed */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
            title="Automatic 10s Live Signal & Market Sync (No manual refresh needed)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono">LIVE • 10s Auto</span>
          </div>

          {/* Candle Close Countdown */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-gray-800/70 border-gray-700 text-gray-300"
            title="Time remaining until the current candle closes"
          >
            <span className="text-gray-400">Candle:</span>
            <span className="font-mono font-semibold text-blue-400">
              {formatTime(secondsUntilNextCandle)}
            </span>
          </div>

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
            <span className="text-gray-500 text-[11px] hidden md:inline">
              Synced {lastUpdated}
            </span>
          </div>
        </div>
      </div>

      <RiskWarning />

      {/* Live Binomo Trade Entry Countdown & Timing Action Panel */}
      {dataAvailable && (
        <TradeTimingCountdown
          interval={selectedInterval}
          currentSignal={currentSignal}
        />
      )}

      {/* DATA UNAVAILABLE banner */}
      {!dataAvailable && (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-gray-900 border border-yellow-800 rounded-xl p-4 text-center">
          <div className="text-4xl sm:text-5xl">⚠️</div>
          <p className="text-yellow-400 font-bold text-lg sm:text-xl">DATA UNAVAILABLE</p>
          <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
            Live market data is currently reconnecting. Signals resume once feed is active.
          </p>
          <button
            onClick={fetchMarketDataAndAnalyze}
            className="mt-2 px-4 py-2 bg-yellow-900/50 border border-yellow-700 text-yellow-300 rounded-lg text-xs sm:text-sm hover:bg-yellow-800/50 transition-colors font-bold"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main grid — Enlarged Chart & Balanced Signal Panel */}
      {dataAvailable && (
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 flex-1 min-h-0">
          {/* Chart — Substantially Enlarged & Responsive */}
          {showChartOnMobile && (
            <div className="w-full lg:w-[63%] min-h-[460px] sm:min-h-[560px] lg:min-h-[620px] flex flex-col">
              {candles.length > 0 ? (
                <CandlestickChart />
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 flex items-center justify-center p-6 min-h-[460px]">
                  <div className="flex flex-col items-center gap-3">
                    <LoadingSpinner />
                    <p className="text-gray-500 text-xs sm:text-sm">Loading market candles…</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Signal panel — Optimized & Responsive */}
          <div className="w-full lg:w-[37%] flex flex-col gap-2.5 sm:gap-3">
            <SignalCard signal={currentSignal} isAnalyzing={isAnalyzing} />

            {/* Binomo Live Execution Order Panel */}
            <BinomoTradePanel
              direction={currentSignal?.direction}
              confidence={currentSignal?.confidence}
            />

            {/* Background auto-analyzing subtle status indicator */}
            {isAnalyzing && currentSignal && (
              <div className="flex items-center justify-between text-[11px] px-3 py-1.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-blue-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  Auto-updating signal with live candles...
                </span>
                <span className="font-mono text-gray-400 text-[10px]">10s Live</span>
              </div>
            )}

            {currentSignal && (
              <>
                <ReasonsList reasons={currentSignal.reasons} />
                <IndicatorPanel indicators={currentSignal.indicators} />
              </>
            )}

            {!currentSignal && !isAnalyzing && candles.length > 0 && candles.length < 20 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-xs sm:text-sm">
                  Accumulating market candles… ({candles.length}/20 loaded)
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live sync footer */}
      {dataAvailable && (
        <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 pt-1">
          <span className="flex items-center gap-2">
            <span>Interval: {selectedInterval}</span>
            <span>•</span>
            <span className="text-emerald-500 font-medium">Auto-Refreshing (Every 10s)</span>
          </span>
          <span className="text-gray-500 text-[11px]">Synced: {lastUpdated}</span>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
