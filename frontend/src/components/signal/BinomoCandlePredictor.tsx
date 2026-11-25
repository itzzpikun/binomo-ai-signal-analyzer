import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useAppStore } from '../../store/appStore';
import {
  getOpenRouterConfig,
  saveOpenRouterConfig,
  OPENROUTER_UPDATED_EVENT,
} from '../../services/api';
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
  usingLatestFormedCandle: boolean;
  hasZeroRange: boolean;
}

export const BinomoCandlePredictor: React.FC<BinomoCandlePredictorProps> = ({
  candles,
  signal,
  isAnalyzing,
}) => {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const selectedInterval = useAppStore((s) => s.selectedInterval);
  const isSimulated = useAppStore((s) => s.isSimulated);

  // Interval seconds: 1min = 60s, 5min = 300s, 15min = 900s
  const intervalSeconds = selectedInterval === '1min' ? 60 : selectedInterval === '15min' ? 900 : 300;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return intervalSeconds - (now % intervalSeconds);
  });
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState(() => getOpenRouterConfig().apiKey);
  const [openrouterSaved, setOpenrouterSaved] = useState(false);

  useEffect(() => {
    const syncKey = () => {
      setOpenrouterKeyInput(getOpenRouterConfig().apiKey);
    };
    window.addEventListener(OPENROUTER_UPDATED_EVENT, syncKey);
    return () => window.removeEventListener(OPENROUTER_UPDATED_EVENT, syncKey);
  }, []);

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

    // Walk back past zero-range live tick stubs (O=H=L=C) to find the latest formed OHLC bar
    let analyzedIdx = candles.length - 1;
    const minIdx = Math.max(2, candles.length - 15);
    while (
      analyzedIdx > minIdx &&
      Math.abs(candles[analyzedIdx].high - candles[analyzedIdx].low) <= 1e-8
    ) {
      analyzedIdx -= 1;
    }

    const usingLatestFormedCandle = analyzedIdx < candles.length - 1;
    const c0 = candles[analyzedIdx];
    const c1 = candles[analyzedIdx - 1];
    const c2 = candles[analyzedIdx - 2];

    const rawRange = Math.max(c0.high - c0.low, 0);
    const hasZeroRange = rawRange <= 1e-8;
    const body = Math.abs(c0.close - c0.open);
    const upperWick = hasZeroRange ? 0 : Math.max(0, c0.high - Math.max(c0.open, c0.close));
    const lowerWick = hasZeroRange ? 0 : Math.max(0, Math.min(c0.open, c0.close) - c0.low);

    let upperWickPercent = 0;
    let bodyPercent = 0;
    let lowerWickPercent = 0;
    if (!hasZeroRange) {
      upperWickPercent = Math.round((upperWick / rawRange) * 100);
      bodyPercent = Math.min(100 - upperWickPercent, Math.round((body / rawRange) * 100));
      lowerWickPercent = Math.max(0, 100 - upperWickPercent - bodyPercent);
    }
    const range = Math.max(rawRange, 0.00001);

    const isBullish = c0.close > c0.open;
    const isBearish = c0.close < c0.open;
    const isDoji = !hasZeroRange && bodyPercent <= 12;

    // Detect Japanese Candlestick Patterns for Binomo 1M/5M
    let patternName = hasZeroRange ? 'Flat Tick (0 Pip Spread)' : 'Balanced Candle Structure';
    let patternType: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let rejectionReason = hasZeroRange
      ? 'Recent candles have zero price movement (awaiting live liquidity).'
      : `Candle range measured (${upperWickPercent}% upper wick, ${bodyPercent}% body, ${lowerWickPercent}% lower wick).`;
    let strategyName = 'Binomo Price Action Confluence';
    let predictedDirection: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
    // Use real model confidence from technical analysis engine if available
    const engineConfidence = signal ? Math.round(signal.confidence) : null;
    const topBackendPattern = signal?.patterns?.[0];

    // Pattern 1: Bullish Pin Bar / Hammer (lower wick >= 55% of range)
    if (!hasZeroRange && lowerWickPercent >= 55 && upperWickPercent <= 20) {
      patternName = bodyPercent <= 12 ? 'Dragonfly Doji / Bullish Pin Bar' : 'Bullish Pin Bar / Hammer';
      patternType = 'bullish';
      rejectionReason = `Lower wick rejection measured at ${lowerWickPercent}% of range. Buyer defense detected at support.`;
      strategyName = 'Binomo Pin Bar Reversal Strategy';
      predictedDirection = 'CALL';
    }
    // Pattern 2: Bearish Pin Bar / Shooting Star (upper wick >= 55% of range)
    else if (!hasZeroRange && upperWickPercent >= 55 && lowerWickPercent <= 20) {
      patternName = bodyPercent <= 12 ? 'Gravestone Doji / Shooting Star' : 'Shooting Star / Bearish Pin Bar';
      patternType = 'bearish';
      rejectionReason = `Upper wick rejection measured at ${upperWickPercent}% of range. Seller rejection detected at resistance.`;
      strategyName = 'Binomo Resistance Rejection Strategy';
      predictedDirection = 'PUT';
    }
    // Pattern 3: Bullish Engulfing
    else if (!hasZeroRange && isBullish && c1.close < c1.open && c0.close > c1.open && c0.open <= c1.close) {
      patternName = 'Bullish Engulfing Pattern';
      patternType = 'bullish';
      rejectionReason = 'Green candle body fully covers previous red candle body.';
      strategyName = 'Binomo Trend Reversal #1';
      predictedDirection = 'CALL';
    }
    // Pattern 4: Bearish Engulfing
    else if (!hasZeroRange && isBearish && c1.close > c1.open && c0.close < c1.open && c0.open >= c1.close) {
      patternName = 'Bearish Engulfing Pattern';
      patternType = 'bearish';
      rejectionReason = 'Red candle body fully covers previous green candle body.';
      strategyName = 'Binomo Trend Reversal #1';
      predictedDirection = 'PUT';
    }
    // Pattern 5: Strong Momentum Marubozu
    else if (!hasZeroRange && bodyPercent >= 80) {
      if (isBullish) {
        patternName = 'Bullish Marubozu (Power Green)';
        patternType = 'bullish';
        rejectionReason = `Solid green candle body covers ${bodyPercent}% of candle range.`;
        strategyName = 'Binomo Strategy #2: Trend Continuation';
        predictedDirection = 'CALL';
      } else {
        patternName = 'Bearish Marubozu (Power Red)';
        patternType = 'bearish';
        rejectionReason = `Solid red candle body covers ${bodyPercent}% of candle range.`;
        strategyName = 'Binomo Strategy #2: Trend Continuation';
        predictedDirection = 'PUT';
      }
    }
    // Pattern 6: Inside Bar Breakout (strict non-zero range on both bars)
    else if (
      !hasZeroRange &&
      Math.abs(c1.high - c1.low) > 1e-8 &&
      c0.high <= c1.high &&
      c0.low >= c1.low &&
      (c0.high < c1.high || c0.low > c1.low)
    ) {
      patternName = 'Inside Bar (Compression)';
      patternType = 'neutral';
      rejectionReason = 'Price range compressed strictly inside previous candle.';
      strategyName = 'Binomo Volatility Squeeze';
      predictedDirection = 'WAIT';
    }
    // Pattern 7: Morning Star / Evening Star (3-candle sequence)
    else if (!hasZeroRange && c2.close < c2.open && Math.abs(c1.close - c1.open) < Math.max(c2.open - c2.low, 1e-8) * 0.3 && isBullish && c0.close > (c2.open + c2.close) / 2) {
      patternName = 'Morning Star (3-Candle Reversal)';
      patternType = 'bullish';
      rejectionReason = '3-candle reversal confirmed: drop, base star, upward candle close above midpoint.';
      strategyName = 'Binomo Morning Star Reversal';
      predictedDirection = 'CALL';
    }
    else if (!hasZeroRange && c2.close > c2.open && Math.abs(c1.close - c1.open) < Math.max(c2.high - c2.low, 1e-8) * 0.3 && isBearish && c0.close < (c2.open + c2.close) / 2) {
      patternName = 'Evening Star (3-Candle Reversal)';
      patternType = 'bearish';
      rejectionReason = '3-candle reversal confirmed: rally, top star, downward candle close below midpoint.';
      strategyName = 'Binomo Evening Star Reversal';
      predictedDirection = 'PUT';
    }
    // Pattern 7b: Multi-candle pattern confirmed by backend AI pattern detector
    else if (topBackendPattern) {
      patternName = topBackendPattern.name;
      patternType = topBackendPattern.type;
      rejectionReason = topBackendPattern.description;
      strategyName = 'Binomo Multi-Candle Pattern';
      predictedDirection = topBackendPattern.type === 'bullish' ? 'CALL' : topBackendPattern.type === 'bearish' ? 'PUT' : 'WAIT';
    }
    // Pattern 8: Incorporate OpenRouter AI / EMA Confluence from Signal if available
    else if (signal) {
      if (signal.direction === 'CALL') {
        patternName = signal.ai_arbiter?.status === 'active' || signal.ai_arbiter?.status === 'cached'
          ? 'OpenRouter AI UP Signal'
          : isBullish ? 'Trend Continuation (EMA 8 Pullback)' : 'Bullish Pullback Dip';
        patternType = 'bullish';
        rejectionReason = signal.ai_arbiter?.analysis_en || 'EMA 8/21 bullish alignment with upward momentum.';
        strategyName = signal.ai_arbiter?.model ? `OpenRouter (${signal.ai_arbiter.model})` : 'Binomo Strategy #1 (EMA 8 / EMA 21 Cross)';
        predictedDirection = 'CALL';
      } else if (signal.direction === 'PUT') {
        patternName = signal.ai_arbiter?.status === 'active' || signal.ai_arbiter?.status === 'cached'
          ? 'OpenRouter AI DOWN Signal'
          : isBearish ? 'Trend Continuation (EMA 8 Drop)' : 'Bearish Pullback Peak';
        patternType = 'bearish';
        rejectionReason = signal.ai_arbiter?.analysis_en || 'EMA 8/21 bearish alignment with downward momentum.';
        strategyName = signal.ai_arbiter?.model ? `OpenRouter (${signal.ai_arbiter.model})` : 'Binomo Strategy #1 (EMA 8 / EMA 21 Cross)';
        predictedDirection = 'PUT';
      } else {
        patternName = isDoji ? 'Doji (Indecision)' : isBullish ? 'Bullish Consolidation Candle' : isBearish ? 'Bearish Consolidation Candle' : 'Consolidation Range';
        patternType = isBullish ? 'bullish' : isBearish ? 'bearish' : 'neutral';
        rejectionReason = (signal.ai_arbiter?.status === 'active' || signal.ai_arbiter?.status === 'cached')
          ? (signal.ai_arbiter?.analysis_en || rejectionReason)
          : `Upper Wick ${upperWickPercent}%, Body ${bodyPercent}%, Lower Wick ${lowerWickPercent}%. Market consolidating before next impulse.`;
        strategyName = 'OpenRouter + Quant Confluence';
        predictedDirection = 'WAIT';
      }
    }

    // When OpenRouter AI actively confirms or supplies CALL/PUT for real market candles, prefer AI+Engine verdict
    if (
      signal &&
      !(isSimulated || candles.some((c) => c.source === 'simulated')) &&
      (signal.ai_arbiter?.status === 'active' || signal.ai_arbiter?.status === 'cached') &&
      (signal.direction === 'CALL' || signal.direction === 'PUT')
    ) {
      predictedDirection = signal.direction;
    }

    // Strict honesty: Never output CALL/PUT from simulated data
    if (isSimulated || candles.some((c) => c.source === 'simulated')) {
      patternName = 'Simulated Candle Data';
      patternType = 'neutral';
      rejectionReason = 'Simulated data — live trading predictions disabled for synthetic prices.';
      strategyName = 'SIMULATED DATA (NO REAL TRADES)';
      predictedDirection = 'WAIT';
    }

    // Honest computed confidence: directly from the 10-indicator engine if available,
    // otherwise derived from measurable geometric strength (wick ratio / body ratio).
    const confidence = (isSimulated || candles.some((c) => c.source === 'simulated'))
      ? 0
      : (engineConfidence !== null
        ? engineConfidence
        : Math.round(Math.max(lowerWickPercent, upperWickPercent, bodyPercent)));

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
      usingLatestFormedCandle,
      hasZeroRange,
    };
  }, [candles, signal, secondsRemaining, intervalSeconds, isSimulated]);

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

      {/* ── Simulated Warning Badge ── */}
      {isSimulated && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 text-xs font-semibold shadow-sm animate-pulse">
          <span className="text-amber-400 text-base">⚠️</span>
          <div>
            <p className="font-bold tracking-wide">SIMULATED - NOT REAL PRICES</p>
            <p className="text-[11px] text-amber-300/80">Binomo OTC candle feed is simulated. Predictions locked to WAIT.</p>
          </div>
        </div>
      )}

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
            {analysis.confidence}% Confluence Score
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
              <span className="text-xs font-mono font-bold text-yellow-400">{selectedInterval} (Fixed)</span>
            </div>
            <div className="bg-gray-950/80 px-2.5 py-1.5 rounded-lg border border-gray-800 text-right">
              <span className="text-[10px] text-gray-400 block">Broker Payout</span>
              <span className="text-xs font-mono font-bold text-gray-300" title="Payout percentage is set dynamically by broker for each asset">Broker Live Rate</span>
            </div>
          </div>
        </div>

        {/* OpenRouter AI Analysis Banner (Sole LLM) */}
        <div className="bg-gray-950/90 border border-blue-900/50 rounded-lg p-2.5 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-blue-300 flex items-center gap-1.5">
              <span>🤖</span>
              <span>OpenRouter AI Analysis</span>
              {signal?.ai_arbiter?.model && (signal.ai_arbiter.status === 'active' || signal.ai_arbiter.status === 'cached') && (
                <span className="text-[10px] font-mono text-gray-400 font-normal">({signal.ai_arbiter.model})</span>
              )}
            </span>
            {signal?.ai_arbiter?.status === 'active' || signal?.ai_arbiter?.status === 'cached' ? (
              <span className={clsx(
                'text-[10px] font-extrabold px-2 py-0.5 rounded-full border',
                signal.ai_arbiter.direction === 'CALL'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : signal.ai_arbiter.direction === 'PUT'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              )}>
                {signal.ai_arbiter.direction === 'CALL' ? 'UP ▲' : signal.ai_arbiter.direction === 'PUT' ? 'DOWN ▼' : 'WAIT ⏸'} • {signal.ai_arbiter.confidence}%
              </span>
            ) : signal?.ai_arbiter?.status === 'disabled' ? (
              <button
                type="button"
                onClick={() => setShowKeyForm((v) => !v)}
                className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-700/60 px-2 py-0.5 rounded hover:bg-amber-900/60"
              >
                {showKeyForm ? 'Close' : '🔑 Set OpenRouter Key'}
              </button>
            ) : (
              <span className="text-[10px] font-bold text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded">
                ⚡ Quant + Candle Engine Active
              </span>
            )}
          </div>

          {signal?.ai_arbiter?.analysis_hi && (
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {signal.ai_arbiter.analysis_hi}
            </p>
          )}
          {signal?.ai_arbiter?.analysis_en && signal.ai_arbiter.status !== 'disabled' && (
            <p className="text-[10px] text-gray-400 italic">
              {signal.ai_arbiter.analysis_en}
            </p>
          )}

          {showKeyForm && (
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-800">
              <input
                type="password"
                value={openrouterKeyInput}
                onChange={(e) => setOpenrouterKeyInput(e.target.value)}
                placeholder="Paste sk-or-v1-... API key"
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  saveOpenRouterConfig(openrouterKeyInput, getOpenRouterConfig().model);
                  setOpenrouterSaved(true);
                  setShowKeyForm(false);
                  setTimeout(() => setOpenrouterSaved(false), 2500);
                }}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded"
              >
                {openrouterSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Hindi Action Guide Pill */}
        <div className="bg-gray-950/90 border border-gray-800/80 p-2.5 rounded-lg text-xs text-gray-200 flex items-start gap-2">
          <span className="text-base flex-shrink-0">💡</span>
          <div>
            <span className="font-bold text-yellow-400">Trading Rule: </span>
            {isCall && (
              <span>Nayi {selectedInterval} candle open hote hi pehle 0-10 seconds me <b>GREEN (UP / CALL)</b> trade lein. Fixed {selectedInterval} expiry rakhein.</span>
            )}
            {isPut && (
              <span>Nayi {selectedInterval} candle open hote hi pehle 0-10 seconds me <b>RED (DOWN / PUT)</b> trade lein. Fixed {selectedInterval} expiry rakhein.</span>
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
                Candle is about to close. Open your Binomo tab, set {selectedInterval} expiry, and prepare to press <b>{analysis.predictedDirection}</b>!
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <span>🕯️</span>
            <span>LIVE BINOMO CANDLE ANATOMY &amp; PATTERN</span>
          </span>
          {analysis.usingLatestFormedCandle && (
            <span className="text-[10px] text-amber-300/90 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-full">
              Latest Formed OHLC Bar
            </span>
          )}
        </div>

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

        {/* OHLC Strip */}
        <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono bg-gray-900/50 border border-gray-800/70 rounded-lg px-2.5 py-1.5 text-gray-400">
          <span>O: <b className="text-gray-200">{analysis.open.toFixed(5)}</b></span>
          <span>H: <b className="text-emerald-300">{analysis.high.toFixed(5)}</b></span>
          <span>L: <b className="text-red-300">{analysis.low.toFixed(5)}</b></span>
          <span>C: <b className={analysis.isBullish ? 'text-emerald-400' : analysis.isBearish ? 'text-red-400' : 'text-gray-200'}>{analysis.close.toFixed(5)}</b></span>
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

          {signal?.patterns && signal.patterns.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {signal.patterns.slice(0, 3).map((pat) => (
                <span
                  key={pat.name}
                  className={clsx(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                    pat.type === 'bullish'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : pat.type === 'bearish'
                      ? 'bg-red-500/15 text-red-300 border-red-500/40'
                      : 'bg-gray-800 text-gray-300 border-gray-700'
                  )}
                >
                  {pat.type === 'bullish' ? '▲' : pat.type === 'bearish' ? '▼' : '•'} {pat.name}
                </span>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-400 italic mt-0.5">
            🔎 <b>Candle Read:</b> {analysis.rejectionReason}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BinomoCandlePredictor;
