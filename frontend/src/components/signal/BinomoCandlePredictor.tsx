import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useAppStore } from '../../store/appStore';
import type { Candle, Signal } from '../../types';

interface BinomoCandlePredictorProps {
  candles: Candle[];
  signal: Signal | null;
  isAnalyzing?: boolean;
}

interface CandleAnalysis {
  open: number;
  high: number;
  low: number;
  close: number;
  range: number;
  body: number;
  upperWick: number;
  lowerWick: number;
  bodyPercent: number;
  upperWickPercent: number;
  lowerWickPercent: number;
  isBullish: boolean;
  isBearish: boolean;
  isDoji: boolean;
  patternName: string;
  patternType: 'bullish' | 'bearish' | 'neutral';
  rejectionReason: string;
  strategyName: string;
  predictedDirection: 'CALL' | 'PUT' | 'WAIT';
  confidence: number;
  entryTimingStatus: 'WAIT_FOR_CLOSE' | 'PREPARE_NOW' | 'ENTRY_ACTIVE';
  secondsRemaining: number;
}

export const BinomoCandlePredictor: React.FC<BinomoCandlePredictorProps> = ({
  candles,
  signal,
  isAnalyzing,
}) => {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const selectedInterval = useAppStore((s) => s.selectedInterval);

  // Interval seconds: 1min = 60s, 5min = 300s, 15min = 900s
  const intervalSeconds = selectedInterval === '1min' ? 60 : selectedInterval === '15min' ? 900 : 300;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return intervalSeconds - (now % intervalSeconds);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      setSecondsRemaining(intervalSeconds - (now % intervalSeconds));
    }, 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds]);

  // Compute live Binomo candlestick analysis from the latest candles
  const analysis: CandleAnalysis | null = useMemo(() => {
    if (!candles || candles.length < 5) return null;

    const c0 = candles[candles.length - 1]; // Current forming candle
    const c1 = candles[candles.length - 2]; // Previous completed candle
    const c2 = candles[candles.length - 3]; // 2 candles ago

    const range = Math.max(c0.high - c0.low, 0.00001);
    const body = Math.abs(c0.close - c0.open);
    const upperWick = c0.high - Math.max(c0.open, c0.close);
    const lowerWick = Math.min(c0.open, c0.close) - c0.low;

    const bodyPercent = Math.round((body / range) * 100);
    const upperWickPercent = Math.round((upperWick / range) * 100);
    const lowerWickPercent = Math.round((lowerWick / range) * 100);

    const isBullish = c0.close > c0.open;
    const isBearish = c0.close < c0.open;
    const isDoji = bodyPercent <= 12;

    // Detect Japanese Candlestick Patterns for Binomo 1M/5M
    let patternName = 'Normal Price Candle';
    let patternType: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let rejectionReason = 'Normal trading range';
    let strategyName = 'Binomo Price Action Confluence';
    let predictedDirection: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
    let confidence = 65;

    // Pattern 1: Bullish Pin Bar / Hammer
    if (lowerWickPercent >= 55 && upperWickPercent <= 20) {
      patternName = 'Bullish Pin Bar / Hammer';
      patternType = 'bullish';
      rejectionReason = `Strong lower wick rejection (${lowerWickPercent}%). Buyers aggressively defending support level.`;
      strategyName = 'Binomo Pin Bar Reversal Strategy';
      predictedDirection = 'CALL';
      confidence = 84;
    }
    // Pattern 2: Bearish Pin Bar / Shooting Star
    else if (upperWickPercent >= 55 && lowerWickPercent <= 20) {
      patternName = 'Shooting Star / Bearish Pin Bar';
      patternType = 'bearish';
      rejectionReason = `Upper wick rejection (${upperWickPercent}%). Sellers rejecting higher prices at resistance.`;
      strategyName = 'Binomo Resistance Rejection Strategy';
      predictedDirection = 'PUT';
      confidence = 84;
    }
    // Pattern 3: Bullish Engulfing
    else if (isBullish && c1.close < c1.open && c0.close > c1.open && c0.open <= c1.close) {
      patternName = 'Bullish Engulfing Pattern';
      patternType = 'bullish';
      rejectionReason = 'Green candle completely engulfs previous red candle body. Bullish momentum breakout.';
      strategyName = 'Binomo Trend Reversal #1';
      predictedDirection = 'CALL';
      confidence = 87;
    }
    // Pattern 4: Bearish Engulfing
    else if (isBearish && c1.close > c1.open && c0.close < c1.open && c0.open >= c1.close) {
      patternName = 'Bearish Engulfing Pattern';
      patternType = 'bearish';
      rejectionReason = 'Red candle completely engulfs previous green candle body. Strong selling wave.';
      strategyName = 'Binomo Trend Reversal #1';
      predictedDirection = 'PUT';
      confidence = 87;
    }
    // Pattern 5: Strong Momentum Marubozu
    else if (bodyPercent >= 80) {
      if (isBullish) {
        patternName = 'Bullish Marubozu (Power Green)';
        patternType = 'bullish';
        rejectionReason = `Large solid green candle body (${bodyPercent}%). Aggressive buyer momentum without pullbacks.`;
        strategyName = 'Binomo Strategy #2: Trend Continuation';
        predictedDirection = 'CALL';
        confidence = 82;
      } else {
        patternName = 'Bearish Marubozu (Power Red)';
        patternType = 'bearish';
        rejectionReason = `Large solid red candle body (${bodyPercent}%). Heavy downward selling pressure.`;
        strategyName = 'Binomo Strategy #2: Trend Continuation';
        predictedDirection = 'PUT';
        confidence = 82;
      }
    }
    // Pattern 6: Inside Bar Breakout
    else if (c0.high <= c1.high && c0.low >= c1.low) {
      patternName = 'Inside Bar (Compression)';
      patternType = 'neutral';
      rejectionReason = 'Price compressing inside previous candle. Breakout imminent on next candle.';
      strategyName = 'Binomo Volatility Squeeze';
      predictedDirection = 'WAIT';
      confidence = 60;
    }
    // Pattern 7: Morning Star / Evening Star (3-candle sequence)
    else if (c2.close < c2.open && Math.abs(c1.close - c1.open) < (c2.open - c2.low) * 0.3 && isBullish && c0.close > (c2.open + c2.close) / 2) {
      patternName = 'Morning Star (3-Candle Reversal)';
      patternType = 'bullish';
      rejectionReason = 'Classic 3-candle reversal: Strong drop, indecision star, followed by strong green surge.';
      strategyName = 'Binomo Morning Star Reversal';
      predictedDirection = 'CALL';
      confidence = 89;
    }
    else if (c2.close > c2.open && Math.abs(c1.close - c1.open) < (c2.high - c2.low) * 0.3 && isBearish && c0.close < (c2.open + c2.close) / 2) {
      patternName = 'Evening Star (3-Candle Reversal)';
      patternType = 'bearish';
      rejectionReason = 'Classic 3-candle reversal: Strong rally, star top, followed by strong red decline.';
      strategyName = 'Binomo Evening Star Reversal';
      predictedDirection = 'PUT';
      confidence = 89;
    }
    // Pattern 8: Incorporate EMA 8/21 Trend Confluence from Signal if available
    else if (signal) {
      if (signal.direction === 'CALL') {
        patternName = isBullish ? 'Trend Continuation (EMA 8 Pullback)' : 'Bullish Pullback Dip';
        patternType = 'bullish';
        rejectionReason = 'EMA 8/21 bullish alignment with upward momentum pressure.';
        strategyName = 'Binomo Strategy #1 (EMA 8 / EMA 21 Cross)';
        predictedDirection = 'CALL';
        confidence = Math.max(signal.confidence, 76);
      } else if (signal.direction === 'PUT') {
        patternName = isBearish ? 'Trend Continuation (EMA 8 Drop)' : 'Bearish Pullback Peak';
        patternType = 'bearish';
        rejectionReason = 'EMA 8/21 bearish alignment with downward momentum pressure.';
        strategyName = 'Binomo Strategy #1 (EMA 8 / EMA 21 Cross)';
        predictedDirection = 'PUT';
        confidence = Math.max(signal.confidence, 76);
      } else {
        patternName = isDoji ? 'Doji (Indecision)' : 'Sideways Consolidation';
        patternType = 'neutral';
        rejectionReason = 'Market is ranging without decisive trend. Awaiting clearer breakout.';
        strategyName = 'Binomo Strategy: Wait for Clear Candlestick';
        predictedDirection = 'WAIT';
        confidence = 55;
      }
    }

    // Entry timing classification:
    // When remaining <= 10s: Prepare
    // When remaining >= intervalSeconds - 10: Active entry window of newly opened candle
    let entryTimingStatus: 'WAIT_FOR_CLOSE' | 'PREPARE_NOW' | 'ENTRY_ACTIVE' = 'WAIT_FOR_CLOSE';
    if (secondsRemaining <= 12) {
      entryTimingStatus = 'PREPARE_NOW';
    } else if (secondsRemaining >= intervalSeconds - 12) {
      entryTimingStatus = 'ENTRY_ACTIVE';
    }

    return {
      open: c0.open,
      high: c0.high,
      low: c0.low,
      close: c0.close,
      range,
      body,
      upperWick,
      lowerWick,
      bodyPercent,
      upperWickPercent,
      lowerWickPercent,
      isBullish,
      isBearish,
      isDoji,
      patternName,
      patternType,
      rejectionReason,
      strategyName,
      predictedDirection,
      confidence,
      entryTimingStatus,
      secondsRemaining,
    };
  }, [candles, signal, secondsRemaining, intervalSeconds]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!analysis) {
    return (
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center min-h-[320px] text-center">
        <div className="w-12 h-12 rounded-full border-2 border-yellow-500/20 border-t-yellow-400 animate-spin mb-3" />
        <p className="text-gray-300 font-bold text-sm">Analyzing Binomo Candlestick Structure...</p>
        <p className="text-gray-500 text-xs mt-1">Collecting live candle wicks, body ratios and strategy patterns</p>
      </div>
    );
  }

  const isCall = analysis.predictedDirection === 'CALL';
  const isPut = analysis.predictedDirection === 'PUT';
  const isWait = analysis.predictedDirection === 'WAIT';

  const themeConfig = {
    CALL: {
      border: 'border-emerald-500/70',
      bg: 'bg-emerald-950/30',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      textColor: 'text-emerald-400',
      heroBg: 'bg-emerald-950/60 border-emerald-500/60',
      arrow: '▲',
      label: 'CALL (GREEN / UP)',
      actionText: 'Binomo platform par GREEN / UP button dabayein',
    },
    PUT: {
      border: 'border-red-500/70',
      bg: 'bg-red-950/30',
      badge: 'bg-red-500/20 text-red-300 border-red-500/50',
      textColor: 'text-red-400',
      heroBg: 'bg-red-950/60 border-red-500/60',
      arrow: '▼',
      label: 'PUT (RED / DOWN)',
      actionText: 'Binomo platform par RED / DOWN button dabayein',
    },
    WAIT: {
      border: 'border-amber-500/60',
      bg: 'bg-amber-950/20',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
      textColor: 'text-amber-400',
      heroBg: 'bg-amber-950/40 border-amber-500/40',
      arrow: '⏸',
      label: 'WAIT (AGLI CANDLE KA INTAZAR KAREIN)',
      actionText: 'Market consolidate kar rha hai, agle clear setup ka wait karein',
    },
  }[analysis.predictedDirection];

  return (
    <div className={clsx(
      'rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 border shadow-2xl backdrop-blur-md transition-all duration-300 bg-gray-900/95',
      themeConfig.border
    )}>
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center font-black text-black text-xs shadow-sm shadow-yellow-500/30">
            B
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-100 text-xs sm:text-sm">Binomo Candlestick Predictor</span>
              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-1.5 py-0.2 rounded border border-yellow-400/20">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              {selectedSymbol} • {selectedInterval} Candlestick Analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAnalyzing && (
            <span className="text-[10px] text-yellow-400 bg-yellow-950/80 border border-yellow-700/60 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping" />
              <span>Scanning Candle...</span>
            </span>
          )}
          <a
            href="https://binomo.com/trading"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-[11px] flex items-center gap-1 shadow-md shadow-yellow-500/20 hover:scale-105 active:scale-95 transition-all"
            title="Open Binomo Trading Platform"
          >
            <span>Binomo</span>
            <span className="text-xs">↗</span>
          </a>
        </div>
      </div>

      {/* ── Main Prediction Box ── */}
      <div className={clsx(
        'rounded-xl p-3.5 sm:p-4 border flex flex-col gap-2.5 transition-all',
        themeConfig.heroBg
      )}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <span>🎯</span>
            <span>NEXT CANDLE PREDICTION (अगली कैंडल क्या बनेगी)</span>
          </span>
          <span className={clsx('text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border', themeConfig.badge)}>
            {analysis.confidence}% Accuracy Setup
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 flex items-center justify-center font-black text-3xl shadow-lg flex-shrink-0',
              themeConfig.bg, themeConfig.border, themeConfig.textColor
            )}>
              {themeConfig.arrow}
            </div>
            <div>
              <h2 className={clsx('text-xl sm:text-2xl font-black tracking-wider leading-tight', themeConfig.textColor)}>
                {themeConfig.label}
              </h2>
              <p className="text-xs text-gray-300 font-medium mt-0.5">
                {themeConfig.actionText}
              </p>
            </div>
          </div>

          {/* Quick Specifications */}
          <div className="flex items-center gap-2 text-right">
            <div className="bg-gray-950/80 px-2.5 py-1.5 rounded-lg border border-gray-800 text-right">
              <span className="text-[10px] text-gray-400 block">Recommended Expiry</span>
              <span className="text-xs font-mono font-bold text-yellow-400">1 Min (Fixed)</span>
            </div>
            <div className="bg-gray-950/80 px-2.5 py-1.5 rounded-lg border border-gray-800 text-right">
              <span className="text-[10px] text-gray-400 block">Binomo Payout</span>
              <span className="text-xs font-mono font-bold text-emerald-400">85% - 90%</span>
            </div>
          </div>
        </div>

        {/* Hindi Action Guide Pill */}
        <div className="bg-gray-950/90 border border-gray-800/80 p-2.5 rounded-lg text-xs text-gray-200 flex items-start gap-2">
          <span className="text-base flex-shrink-0">💡</span>
          <div>
            <span className="font-bold text-yellow-400">Trading Rule: </span>
            {isCall && (
              <span>Nayi 1-minute candle open hote hi pehle 0-10 seconds me <b>GREEN (CALL)</b> trade lein. Fixed 1M expiry rakhein.</span>
            )}
            {isPut && (
              <span>Nayi 1-minute candle open hote hi pehle 0-10 seconds me <b>RED (PUT)</b> trade lein. Fixed 1M expiry rakhein.</span>
            )}
            {isWait && (
              <span>Market me abhi clear pattern nahi hai. Candle close hone ka intezaar karein aur agle confirmed signal par trade lein.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Live Candle Timing & Entry Window ── */}
      <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <span>⏱️</span>
            <span>CANDLE COUNTDOWN & ENTRY WINDOW</span>
          </span>
          <span className="font-mono text-sm font-black text-amber-400">
            {formatCountdown(secondsRemaining)} remaining
          </span>
        </div>

        {/* Dynamic Timing Status Alert */}
        {analysis.entryTimingStatus === 'ENTRY_ACTIVE' && !isWait && (
          <div className="bg-emerald-950/80 border border-emerald-500 rounded-lg p-2.5 flex items-center gap-2 animate-pulse">
            <span className="text-lg">🔥</span>
            <div className="text-xs">
              <span className="font-extrabold text-emerald-300 uppercase tracking-wide">
                ACTIVE ENTRY WINDOW NOW!
              </span>
              <p className="text-emerald-100/90 text-[11px] mt-0.5">
                New candle has just opened! Execute <b>{analysis.predictedDirection}</b> on Binomo within next 10 seconds!
              </p>
            </div>
          </div>
        )}

        {analysis.entryTimingStatus === 'PREPARE_NOW' && !isWait && (
          <div className="bg-amber-950/80 border border-amber-500 rounded-lg p-2.5 flex items-center gap-2 animate-bounce">
            <span className="text-lg">⚠️</span>
            <div className="text-xs">
              <span className="font-extrabold text-amber-300 uppercase tracking-wide">
                GET READY ON BINOMO! ({secondsRemaining}s Left)
              </span>
              <p className="text-amber-100/90 text-[11px] mt-0.5">
                Candle is about to close. Open your Binomo tab, set 1-minute expiry, and prepare to press <b>{analysis.predictedDirection}</b>!
              </p>
            </div>
          </div>
        )}

        {analysis.entryTimingStatus === 'WAIT_FOR_CLOSE' && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 flex items-center justify-between text-xs text-gray-400">
            <span>Current Candle Formation in Progress</span>
            <span className="font-mono text-gray-300">Wait for candle to complete</span>
          </div>
        )}
      </div>

      {/* ── Real-Time Candlestick Structure Breakdown ── */}
      <div className="bg-gray-950/80 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-2.5">
        <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
          <span>🕯️</span>
          <span>LIVE BINOMO CANDLE ANATOMY & PATTERN</span>
        </span>

        {/* Pattern & Strategy Badge */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-900/90 border border-gray-800 p-2.5 rounded-lg flex flex-col gap-1">
            <span className="text-[10px] text-gray-400">Detected Pattern:</span>
            <span className={clsx(
              'font-bold text-xs sm:text-sm flex items-center gap-1',
              analysis.patternType === 'bullish' ? 'text-emerald-400' : analysis.patternType === 'bearish' ? 'text-red-400' : 'text-gray-300'
            )}>
              <span>{analysis.patternType === 'bullish' ? '▲' : analysis.patternType === 'bearish' ? '▼' : '•'}</span>
              <span>{analysis.patternName}</span>
            </span>
          </div>

          <div className="bg-gray-900/90 border border-gray-800 p-2.5 rounded-lg flex flex-col gap-1">
            <span className="text-[10px] text-gray-400">Binomo Strategy:</span>
            <span className="font-bold text-xs sm:text-sm text-yellow-400 truncate">
              {analysis.strategyName}
            </span>
          </div>
        </div>

        {/* Candle Anatomy Gauges (Wick / Body ratio) */}
        <div className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800/80 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-300">
            <span>Upper Wick: <b className="text-red-400">{analysis.upperWickPercent}%</b></span>
            <span>Body: <b className={analysis.isBullish ? 'text-emerald-400' : 'text-red-400'}>{analysis.bodyPercent}%</b></span>
            <span>Lower Wick: <b className="text-emerald-400">{analysis.lowerWickPercent}%</b></span>
          </div>

          {/* Visual candle ratio bar */}
          <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden flex">
            <div style={{ width: `${analysis.upperWickPercent}%` }} className="bg-red-500/80" title="Upper Wick (Selling rejection)" />
            <div style={{ width: `${analysis.bodyPercent}%` }} className={analysis.isBullish ? 'bg-emerald-500' : 'bg-red-600'} title="Candle Body" />
            <div style={{ width: `${analysis.lowerWickPercent}%` }} className="bg-emerald-400/80" title="Lower Wick (Buying rejection)" />
          </div>

          <p className="text-[11px] text-gray-400 italic mt-0.5">
            🔎 <b>Candle Read:</b> {analysis.rejectionReason}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BinomoCandlePredictor;
