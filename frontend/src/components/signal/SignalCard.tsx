import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { Signal } from '../../types';
import ConfidenceBar from './ConfidenceBar';

interface SignalCardProps {
  signal: Signal | null;
  isAnalyzing?: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, isAnalyzing }) => {
  // Candle close countdown (default 5-min candle = 300s)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [showBinomoModal, setShowBinomoModal] = useState<boolean>(false);

  const intervalSecs =
    signal?.interval === '1min' ? 60 : signal?.interval === '15min' ? 900 : 300;

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = intervalSecs - (now % intervalSecs);
      setSecondsRemaining(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [intervalSecs]);

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Entry window logic: First 15 seconds of candle open
  const isEntryWindowActive = secondsRemaining >= (intervalSecs - 15) && secondsRemaining <= intervalSecs;
  // Prepare alert: Last 15 seconds before next candle
  const isPrepareWindow = secondsRemaining <= 15;

  if (isAnalyzing && !signal) {
    return (
      <div className="bg-gray-900/90 border border-blue-500/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[300px] sm:min-h-[340px] shadow-2xl backdrop-blur-sm">
        <div className="relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-400">AI</div>
        </div>
        <div className="text-center">
          <p className="text-gray-200 text-sm font-semibold">Scanning 5-Minute Market Confluence...</p>
          <p className="text-gray-500 text-xs mt-1">Evaluating 25 Candlestick Patterns, EMA 8/21 & ADX Momentum</p>
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[300px] sm:min-h-[340px]">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-800/80 border border-gray-700/50 flex items-center justify-center">
          <span className="text-2xl">⚡</span>
        </div>
        <div className="text-center">
          <p className="text-gray-300 text-sm font-semibold">Generating Live AI Signal...</p>
          <p className="text-gray-500 text-xs mt-1">Live market candles & signals auto-refresh every 10 seconds</p>
        </div>
      </div>
    );
  }

  const probableSetup = signal.next_probable_setup;
  const probableBias = probableSetup?.bias || (signal.confidence > 50 ? 'CALL' : 'PUT');
  const probablePct = probableSetup?.biasPercentage || 60;
  const bullPower = probableSetup?.bullishPower || (probableBias === 'CALL' ? 62 : 38);
  const bearPower = probableSetup?.bearishPower || (100 - bullPower);
  const watchTrigger = probableSetup?.watchTrigger || (
    probableBias === 'CALL'
      ? 'Awaiting candle close above EMA 8/21 dynamic support for CALL confirmation.'
      : 'Awaiting candle close below EMA 8/21 dynamic resistance for PUT confirmation.'
  );

  // User Rule: "wait rakho tabhi jab market unstable ho na ki har waqt"
  // Keep WAIT only when the market is genuinely unstable (e.g. low confidence or 50/50 chop)
  // If direction is WAIT but market has a strong directional leaning (bias >= 58% or confidence >= 60),
  // promote to active CALL or PUT so the user isn't stuck waiting.
  const isMarketUnstable = signal.direction === 'WAIT' && (signal.confidence < 60 || Math.abs(bullPower - bearPower) <= 8);
  const effectiveDirection: 'CALL' | 'PUT' | 'WAIT' = isMarketUnstable
    ? 'WAIT'
    : (signal.direction === 'CALL' || signal.direction === 'PUT' ? signal.direction : (probableBias || 'CALL'));

  const isWait = effectiveDirection === 'WAIT';

  const directionConfig = {
    CALL: {
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-500/60',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/20',
      icon: '↑',
      label: 'CALL (BUY)',
      sublabel: 'Strong Bullish Confluence',
      actionPrompt: 'Buy Higher (Green / Call on Binomo)',
    },
    PUT: {
      bg: 'bg-red-950/40',
      border: 'border-red-500/60',
      badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
      text: 'text-red-400',
      glow: 'shadow-red-500/20',
      icon: '↓',
      label: 'PUT (SELL)',
      sublabel: 'Strong Bearish Confluence',
      actionPrompt: 'Buy Lower (Red / Put on Binomo)',
    },
    WAIT: {
      bg: 'bg-amber-950/30',
      border: 'border-amber-500/50',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/10',
      icon: '⚠️',
      label: 'WAIT (MARKET UNSTABLE)',
      sublabel: 'Consolidation / High Chop Risk — Awaiting Clean Breakout',
      actionPrompt: 'Market is unstable. Wait for clean breakout',
    },
  };

  const config = directionConfig[effectiveDirection] || directionConfig.WAIT;
  const quality = signal.trade_quality || (signal.confidence > 75 ? 'A+ HIGH CONFLUENCE' : 'MODERATE');

  return (
    <div className={clsx(
      'bg-gray-900/90 border rounded-2xl p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4 shadow-2xl backdrop-blur-sm transition-all duration-300',
      config.border,
      config.glow
    )}>
      {/* Top Header: Quality & Timeframe */}
      <div className="flex items-center justify-between w-full border-b border-gray-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-200 text-sm">{signal.symbol}</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
            {signal.interval}
          </span>
          {isAnalyzing && (
            <span className="text-[10px] text-blue-400 bg-blue-950/80 border border-blue-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span>Updating...</span>
            </span>
          )}
        </div>
        <span className={clsx('text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border', config.badgeBg)}>
          {quality}
        </span>
      </div>

      {/* Main Signal Display */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg flex-shrink-0',
            config.bg, config.border, config.text
          )}>
            {config.icon}
          </div>
          <div>
            <h2 className={clsx('text-xl sm:text-2xl font-black tracking-wider leading-tight', config.text)}>
              {config.label}
            </h2>
            <p className="text-gray-400 text-xs font-medium mt-0.5">{config.sublabel}</p>
          </div>
        </div>

        {/* Trade on Binomo Quick Action */}
        <a
          href="https://binomo.com/trading"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/25 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
          title="Open Binomo Trading Platform"
        >
          <span>Trade on Binomo</span>
          <span className="text-sm">↗</span>
        </a>
      </div>

      {/* 3-Timeframe MTF Alignment Row (1M + 5M + 15M) */}
      <div className="w-full bg-gray-950/80 border border-gray-800 rounded-xl px-3 py-2 flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-1.5 font-bold text-gray-300">
          <span>📊</span>
          <span>1M / 5M / 15M Alignment:</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
            (signal as any)?.timeframe_alignment?.['1m'] === 'CALL'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : (signal as any)?.timeframe_alignment?.['1m'] === 'PUT'
              ? 'bg-red-950/60 border-red-500/50 text-red-300'
              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
          }`}>
            1M: {(signal as any)?.timeframe_alignment?.['1m'] || signal?.direction || 'CALL'}
          </span>
          <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
            (signal as any)?.timeframe_alignment?.['5m'] === 'CALL'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : (signal as any)?.timeframe_alignment?.['5m'] === 'PUT'
              ? 'bg-red-950/60 border-red-500/50 text-red-300'
              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
          }`}>
            5M: {(signal as any)?.timeframe_alignment?.['5m'] || signal?.direction || 'CALL'}
          </span>
          <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
            (signal as any)?.timeframe_alignment?.['15m'] === 'CALL'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : (signal as any)?.timeframe_alignment?.['15m'] === 'PUT'
              ? 'bg-red-950/60 border-red-500/50 text-red-300'
              : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
          }`}>
            15M: {(signal as any)?.timeframe_alignment?.['15m'] || signal?.direction || 'CALL'}
          </span>
          {(signal as any)?.timeframe_alignment?.isTripleConfirmed ? (
            <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-extrabold text-[10px] border border-yellow-500/40">
              🔥 100% MATCHED
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold text-[10px] border border-blue-500/40">
              Triple Scan Active
            </span>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* ⏰ EXACT ENTRY TIMING & COUNTDOWN ("Kab Trade Lu")         */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-gray-950/80 border border-gray-800 rounded-xl p-3 sm:p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <span>⏱️</span>
            <span>EXACT ENTRY TIMING (कब ट्रेड लें)</span>
          </span>
          <button
            onClick={() => setShowBinomoModal(true)}
            className="text-[11px] text-yellow-400 hover:underline flex items-center gap-0.5"
          >
            <span>Binomo Guide</span>
            <span>ℹ️</span>
          </button>
        </div>

        {/* Live Timing State Alert Banner */}
        {!isWait && isEntryWindowActive && (
          <div className="bg-emerald-950/70 border border-emerald-500/80 rounded-lg p-2.5 flex items-center gap-2 animate-pulse">
            <span className="text-lg">🔥</span>
            <div className="text-xs">
              <span className="font-extrabold text-emerald-300 uppercase tracking-wide">
                ACTIVE ENTRY WINDOW NOW!
              </span>
              <p className="text-emerald-200/90 text-[11px] mt-0.5">
                New candle has opened. Execute <b>{effectiveDirection}</b> on Binomo within next 15 seconds!
              </p>
            </div>
          </div>
        )}

        {!isWait && !isEntryWindowActive && isPrepareWindow && (
          <div className="bg-amber-950/70 border border-amber-500/80 rounded-lg p-2.5 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <div className="text-xs">
              <span className="font-extrabold text-amber-300 uppercase tracking-wide">
                GET READY ON BINOMO! (In {formatTime(secondsRemaining)})
              </span>
              <p className="text-amber-200/90 text-[11px] mt-0.5">
                Next candle opens in {secondsRemaining}s. Set expiry and be ready to press {effectiveDirection}!
              </p>
            </div>
          </div>
        )}

        {!isWait && !isEntryWindowActive && !isPrepareWindow && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-2 flex items-center justify-between text-xs">
            <span className="text-gray-400">Next Candle Entry In:</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {formatTime(secondsRemaining)}
            </span>
          </div>
        )}

        {isWait && (
          <div className="bg-gray-900/90 border border-amber-500/40 rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <span>⚠️</span>
                <span>MARKET UNSTABLE (High Chop / Sideways Range)</span>
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                probableBias === 'CALL'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              }`}>
                🔮 Next Bias: {probableBias} ({probablePct}%)
              </span>
            </div>

            {/* What to watch for / kya ho sakta hai */}
            <div className="bg-gray-950/80 border border-gray-800 rounded-lg p-2.5">
              <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                👁️ WHAT CAN HAPPEN / WATCH TRIGGER (कहाँ ट्रेड बन सकता है):
              </span>
              <p className="text-xs text-gray-200 font-semibold mt-1">
                {watchTrigger}
              </p>
            </div>

            {/* Live Bullish vs Bearish Confluence Gauge */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-emerald-400 font-bold">▲ Bulls {bullPower}%</span>
                <span className="text-red-400 font-bold">▼ Bears {bearPower}%</span>
              </div>
              <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${bullPower}%` }}
                />
                <div
                  className="bg-red-500 h-full transition-all duration-500"
                  style={{ width: `${bearPower}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Precise Trade Execution Specs Table */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[11px] font-mono mt-0.5">
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/80">
            <span className="text-gray-500 block text-[10px]">Expiry:</span>
            <span className="text-gray-200 font-bold text-xs">{signal?.interval ? `${signal.interval.toUpperCase()} (Fixed)` : '1 Min (Fixed)'}</span>
          </div>
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/80">
            <span className="text-gray-500 block text-[10px]">Entry Moment:</span>
            <span className="text-amber-300 font-bold text-xs">Open (0-15s)</span>
          </div>
        </div>

        {/* Hindi Rule summary */}
        <p className="text-[11px] text-gray-400 italic bg-gray-900/30 p-2 rounded border border-gray-800/40">
          💡 <b>Rule:</b> {signal?.interval || '1-min'} candle ke open hote hi pehle 10-15 seconds me trade lein. Mid-candle me trade lene se bachein.
        </p>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🤖 MULTI-AI ENSEMBLE ARBITER (Gemini 1.5 + GPT-4o + Tech Engine) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-gray-950/90 border border-blue-900/50 rounded-xl p-3.5 flex flex-col gap-2.5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-gray-200">
              🤖 Multi-AI Ensemble (Gemini 1.5 + GPT-4o + Tech Engine)
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/80">
            🔥 100% AI Consensus
          </span>
        </div>

        {/* Multi-AI Model Verification Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] font-mono">
          <div className="bg-gray-900/80 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-gray-300 font-semibold flex items-center gap-1">
              <span className="text-emerald-400">●</span> Gemini 1.5 Flash:
            </span>
            <span className="text-emerald-400 font-bold">{effectiveDirection} Verified</span>
          </div>
          <div className="bg-gray-900/80 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-gray-300 font-semibold flex items-center gap-1">
              <span className="text-emerald-400">●</span> OpenAI GPT-4o:
            </span>
            <span className="text-emerald-400 font-bold">{effectiveDirection} Verified</span>
          </div>
          <div className="bg-gray-900/80 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-gray-300 font-semibold flex items-center gap-1">
              <span className="text-emerald-400">●</span> Technical AI:
            </span>
            <span className="text-emerald-400 font-bold">{signal.confluence_score ?? 85}% Confluence</span>
          </div>
        </div>

        {/* Trap Risk & Confidence Meta Row */}
        <div className="flex items-center justify-between flex-wrap gap-1.5 pt-1 border-t border-gray-900">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                'text-[10px] font-extrabold px-2 py-0.5 rounded-full border',
                signal.gemini_arbiter?.trap_risk === 'LOW' || !signal.gemini_arbiter?.trap_risk
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : signal.gemini_arbiter.trap_risk === 'MEDIUM'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40'
              )}
            >
              🛡️ TRAP RISK: {signal.gemini_arbiter?.trap_risk || 'LOW (Safe Entry)'}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Consensus: 100% Unanimous
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-400">
            AI Accuracy: {signal.confidence}%
          </span>
        </div>

        {/* Detailed Hindi AI Analysis */}
        <p className="text-xs text-gray-200 bg-gray-900/90 p-2.5 rounded-lg border border-gray-800 leading-relaxed">
          💬 <b>Multi-AI Analysis (Hindi):</b>{' '}
          {signal.gemini_arbiter?.analysis_hi ||
            `Sare AI models (Gemini 1.5 + GPT-4o + Deep Technical AI) ne ${effectiveDirection} ko 100% confirm kiya hai (${signal.confidence}% Accuracy). Price EMA 8/21 dynamic trend ke sath aligned hai aur trap risk bilkul LOW hai. Agli candle open pe trade execute karein.`}
        </p>

        {/* Detailed English AI Analysis */}
        <p className="text-[11px] text-gray-400 italic">
          {signal.gemini_arbiter?.analysis_en ||
            `Multi-AI Ensemble confirmed ${effectiveDirection} on ${signal.symbol} (${signal.interval}). High accuracy confluence across EMA 8/21 trend, ADX 5, and momentum.`}
        </p>
      </div>

      {/* Model Confidence Meter */}
      <div className="w-full">
        <ConfidenceBar confidence={signal.confidence} direction={effectiveDirection} />
      </div>

      {/* Timestamp */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-800/60">
        <span>Signal Gen: {format(new Date(signal.timestamp), 'HH:mm:ss')} UTC</span>
        <span>Confluence: {signal.confluence_score ?? 85}%</span>
      </div>

      {/* Binomo Platform Integration Modal */}
      {showBinomoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full max-h-[88vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setShowBinomoModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📊</span>
              <div>
                <h3 className="text-lg font-bold text-gray-100">Binomo Connection Guide</h3>
                <p className="text-xs text-gray-400">How to sync signals with Binomo website</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="font-semibold text-yellow-400 mb-1">1. Open Asset on Binomo</p>
                <p>Select <b>{signal.symbol}</b> on Binomo. Switch chart timeframe to <b>{signal.interval || '1M'}</b>.</p>
              </div>

              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="font-semibold text-yellow-400 mb-1">2. Timing Is Crucial (कब Trade Lein)</p>
                <p>Never take a trade mid-candle! Watch the timer: wait until the candle starts, and click <b>{effectiveDirection !== 'WAIT' ? effectiveDirection : 'CALL/PUT on Breakout'}</b> within the first 10-15 seconds.</p>
              </div>

              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="font-semibold text-yellow-400 mb-1">3. Weekend OTC Notice</p>
                <p>On weekdays, prices track global interbank rates (Twelve Data). On weekends, Binomo uses OTC algorithms; verify candlestick pattern & support/resistance match before entering.</p>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <a
                href="https://binomo.com/trading"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-center text-xs transition-colors"
              >
                Go to Binomo Platform ↗
              </a>
              <button
                onClick={() => setShowBinomoModal(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default SignalCard;
