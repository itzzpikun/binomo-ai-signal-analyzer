import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import ConfidenceBar from './ConfidenceBar';
import type { Signal } from '../../types';

interface SignalCardProps {
  signal: Signal | null;
  isAnalyzing?: boolean;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, isAnalyzing = false }) => {
  const [showBinomoModal, setShowBinomoModal] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  // Interval duration in seconds
  const intervalSeconds = signal?.interval === '1min' ? 60 : signal?.interval === '15min' ? 900 : 300;

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = intervalSeconds - (now % intervalSeconds);
      setSecondsRemaining(remaining);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isEntryWindowActive = secondsRemaining >= intervalSeconds - 10;
  const isPrepareWindow = secondsRemaining <= 10;

  if (!signal) {
    return (
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[300px] sm:min-h-[340px]">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-800/80 border border-gray-700/50 flex items-center justify-center">
          <span className="text-2xl">⚡</span>
        </div>
        <div className="text-center">
          <p className="text-gray-300 text-sm font-semibold">Generating Quantitative Setup...</p>
          <p className="text-gray-500 text-xs mt-1">Live market candles &amp; 100-point confluence engine running</p>
        </div>
      </div>
    );
  }

  const score = signal.confidence;
  const breakdown = (signal as any).score_breakdown || {
    trendScore: Math.round(score * 0.25),
    momentumScore: Math.round(score * 0.20),
    priceActionScore: Math.round(score * 0.20),
    mtfScore: Math.round(score * 0.20),
    volatilityScore: Math.round(score * 0.15),
    totalScore: score,
  };

  const probableSetup = signal.next_probable_setup;
  const probableBias = probableSetup?.bias || (signal.confidence > 50 ? 'CALL' : 'PUT');
  const probablePct = probableSetup?.biasPercentage || 60;
  const bullPower = probableSetup?.bullishPower || (probableBias === 'CALL' ? 62 : 38);
  const bearPower = probableSetup?.bearishPower || (100 - bullPower);

  // Strict Quantitative Policy:
  // Score >= 70 and no filter triggered -> CALL or PUT
  // Below 70 or Filter Triggered -> WAIT
  const effectiveDirection: 'CALL' | 'PUT' | 'WAIT' =
    (signal.direction === 'CALL' || signal.direction === 'PUT') && score >= 70
      ? signal.direction
      : 'WAIT';

  const isWait = effectiveDirection === 'WAIT';
  const regime = (signal as any).market_regime || 'TRENDING';
  const filterInfo = (signal as any).false_signal_filter;
  const waitReason =
    filterInfo?.reason ||
    (signal as any).reasons?.wait_reasons?.[0] ||
    `Setup Score (${score}/100) below the 70-point threshold`;

  const qualityTier =
    effectiveDirection !== 'WAIT'
      ? score >= 85
        ? 'Strong Setup (85-100 pts)'
        : 'Moderate Setup (70-84 pts)'
      : 'WAIT (Awaiting 70+ Score Confluence)';

  const directionConfig = {
    CALL: {
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-500/60',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/20',
      icon: '↑',
      label: 'CALL (BUY)',
      sublabel: `Setup Score: ${score}/100 • ${qualityTier}`,
    },
    PUT: {
      bg: 'bg-red-950/40',
      border: 'border-red-500/60',
      badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
      text: 'text-red-400',
      glow: 'shadow-red-500/20',
      icon: '↓',
      label: 'PUT (SELL)',
      sublabel: `Setup Score: ${score}/100 • ${qualityTier}`,
    },
    WAIT: {
      bg: 'bg-amber-950/30',
      border: 'border-amber-500/60',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      text: 'text-amber-400',
      glow: 'shadow-amber-500/10',
      icon: probableBias === 'CALL' ? '▲' : '▼',
      label: `WAIT • LIKELY ${probableBias} (${probablePct}%)`,
      sublabel: `Status: Trade Paused (WAIT) • Developing: ${probableBias} (${probablePct}%)`,
    },
  };

  const config = directionConfig[effectiveDirection];
  const mtf = (signal as any).timeframe_alignment;

  return (
    <div
      className={clsx(
        'bg-gray-900/90 border rounded-2xl p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4 shadow-2xl backdrop-blur-sm transition-all duration-300',
        config.border,
        config.glow
      )}
    >
      {/* Top Header: Symbol, Timeframe, Regime, Quality */}
      <div className="flex items-center justify-between w-full border-b border-gray-800/80 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-200 text-sm">{signal.symbol}</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
            {signal.interval}
          </span>
          <span
            className={clsx(
              'text-[10px] font-mono font-bold px-2 py-0.5 rounded border',
              regime === 'TRENDING'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : regime === 'VOLATILE'
                ? 'bg-red-950/60 border-red-500/40 text-red-300'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
            )}
          >
            {regime} REGIME
          </span>
          {isAnalyzing && (
            <span className="text-[10px] text-blue-400 bg-blue-950/80 border border-blue-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span>Updating...</span>
            </span>
          )}
        </div>
        <span className={clsx('text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full border', config.badgeBg)}>
          {qualityTier}
        </span>
      </div>

      {/* Main Signal Direction Display */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg flex-shrink-0',
              config.bg,
              config.border,
              config.text
            )}
          >
            {config.icon}
          </div>
          <div>
            <h2 className={clsx('text-xl sm:text-2xl font-black tracking-wider leading-tight', config.text)}>
              {config.label}
            </h2>
            <p className="text-gray-400 text-xs font-medium mt-0.5">{config.sublabel}</p>
          </div>
        </div>

        {/* Trade on Binomo Action */}
        <a
          href="https://binomo.com/trading"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto px-4 py-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/25 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
          title="Open Official Binomo Trading Platform"
        >
          <span>Trade on Binomo</span>
          <span className="text-sm">↗</span>
        </a>
      </div>

      {/* 🔮 DEVELOPING MARKET BIAS: NEXT TRADE PREDICTION (Shown prominently during WAIT) */}
      {isWait && (
        <div className="w-full bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border border-amber-500/40 rounded-xl p-3 sm:p-4 flex flex-col gap-2.5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg animate-pulse">🔮</span>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-gray-100 flex items-center gap-1.5">
                  <span>Developing Market Bias (Next Possible Trade)</span>
                </span>
                <span className="text-[11px] text-gray-400 block">
                  Wait ke baad agla potential trade kis taraf ban raha hai:
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'text-xs sm:text-sm font-black px-3 py-1 rounded-lg border flex items-center gap-1.5 shadow-md',
                  probableBias === 'CALL'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-emerald-500/20'
                    : 'bg-red-500/20 text-red-300 border-red-500/60 shadow-red-500/20'
                )}
              >
                <span>{probableBias === 'CALL' ? '▲ LIKELY NEXT: CALL (BUY)' : '▼ LIKELY NEXT: PUT (SELL)'}</span>
                <span className="font-mono text-xs opacity-90">({probablePct}% Odds)</span>
              </span>
            </div>
          </div>

          {/* Bullish vs Bearish Power Meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono font-bold">
              <span className="text-emerald-400 flex items-center gap-1">
                <span>▲ Bullish Momentum:</span> <strong>{bullPower}%</strong>
              </span>
              <span className="text-red-400 flex items-center gap-1">
                <span>▼ Bearish Selling:</span> <strong>{bearPower}%</strong>
              </span>
            </div>
            <div className="w-full bg-gray-800/90 h-2.5 rounded-full overflow-hidden flex border border-gray-700">
              <div
                className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full transition-all duration-500"
                style={{ width: `${bullPower}%` }}
              />
              <div
                className="bg-gradient-to-r from-red-400 to-red-600 h-full transition-all duration-500"
                style={{ width: `${bearPower}%` }}
              />
            </div>
          </div>

          {/* Detailed Dual Guidance Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-2.5">
              <span className="text-[10px] font-bold text-amber-400 block uppercase tracking-wider flex items-center gap-1">
                <span>🛑</span>
                <span>Abhi Kyun Ruka Hai (Wait Reason):</span>
              </span>
              <p className="text-amber-200 text-xs font-semibold mt-1 leading-snug">
                {waitReason}
              </p>
            </div>

            <div
              className={clsx(
                'rounded-lg p-2.5 border',
                probableBias === 'CALL'
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/30 border-red-500/40 text-red-200'
              )}
            >
              <span className="text-[10px] font-bold block uppercase tracking-wider flex items-center gap-1 opacity-90">
                <span>🎯</span>
                <span>Confirmed Trade Kab Banna Hai (Trigger):</span>
              </span>
              <p className="text-xs font-semibold mt-1 leading-snug">
                {probableSetup?.watchTrigger || (probableBias === 'CALL'
                  ? 'Agli candle EMA 9 ke upar RSI > 50 ke sath close hone par confirmed CALL active hoga.'
                  : 'Agli candle EMA 9 ke niche RSI < 50 ke sath close hone par confirmed PUT active hoga.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 📊 100-POINT QUANTITATIVE SCORING BREAKDOWN (Section 4)    */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-gray-950/80 border border-gray-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-300 flex items-center gap-1.5">
            <span>📊</span>
            <span>100-Point Setup Score Breakdown</span>
          </span>
          <span className="font-mono font-extrabold text-white text-xs">
            {score} / 100 Points
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] font-mono">
          <div className="bg-gray-900/90 border border-gray-800 p-2 rounded-lg">
            <span className="text-gray-500 block text-[10px]">Trend (25)</span>
            <span className="font-bold text-emerald-400">{breakdown.trendScore} pts</span>
          </div>
          <div className="bg-gray-900/90 border border-gray-800 p-2 rounded-lg">
            <span className="text-gray-500 block text-[10px]">Momentum (20)</span>
            <span className="font-bold text-blue-400">{breakdown.momentumScore} pts</span>
          </div>
          <div className="bg-gray-900/90 border border-gray-800 p-2 rounded-lg">
            <span className="text-gray-500 block text-[10px]">Price Action (20)</span>
            <span className="font-bold text-purple-400">{breakdown.priceActionScore} pts</span>
          </div>
          <div className="bg-gray-900/90 border border-gray-800 p-2 rounded-lg">
            <span className="text-gray-500 block text-[10px]">MTF Align (20)</span>
            <span className={clsx('font-bold', breakdown.mtfScore >= 10 ? 'text-emerald-400' : 'text-amber-400')}>
              {breakdown.mtfScore} pts
            </span>
          </div>
          <div className="bg-gray-900/90 border border-gray-800 p-2 rounded-lg">
            <span className="text-gray-500 block text-[10px]">Volatility (15)</span>
            <span className="font-bold text-amber-400">{breakdown.volatilityScore} pts</span>
          </div>
        </div>

        {/* Multi-Timeframe Matrix Row */}
        {mtf && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-900 text-xs">
            <span className="text-gray-400 text-[11px]">MTF Agreement:</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-300">
                1M: {mtf['1m'] || 'WAIT'}
              </span>
              <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-300">
                5M: {mtf['5m'] || 'WAIT'}
              </span>
              <span className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-300">
                15M: {mtf['15m'] || 'WAIT'}
              </span>
              {mtf.conflictDetected ? (
                <span className="px-2 py-0.5 rounded bg-red-950/60 border border-red-500/50 text-red-300 font-bold text-[10px]">
                  Conflict
                </span>
              ) : mtf.isAligned ? (
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-bold text-[10px]">
                  Aligned
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* ⏰ EXACT ENTRY TIMING & COUNTDOWN (Section 6)              */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-gray-950/80 border border-gray-800 rounded-xl p-3 sm:p-3.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
            <span>⏱️</span>
            <span>EXACT ENTRY TIMING &amp; EXPIRY PROTOCOL</span>
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
                ACTIVE ENTRY WINDOW NOW (0-10s)!
              </span>
              <p className="text-emerald-200/90 text-[11px] mt-0.5">
                New candle opened. Execute <b>{effectiveDirection}</b> on Binomo within first 10 seconds!
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
                Next candle opens in {secondsRemaining}s. Set expiry and prepare {effectiveDirection} order.
              </p>
            </div>
          </div>
        )}

        {!isWait && !isEntryWindowActive && !isPrepareWindow && (
          <div className="bg-rose-950/50 border border-rose-500/60 rounded-lg p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">⛔</span>
              <div>
                <span className="font-extrabold text-rose-300 uppercase tracking-wide block">
                  MID-CANDLE LATE ENTRY BLOCKED!
                </span>
                <p className="text-rose-200/80 text-[11px] mt-0.5">
                  Candle already running. DO NOT enter now to avoid wick loss. Next open in:
                </p>
              </div>
            </div>
            <span className="font-mono font-black text-rose-400 text-sm flex-shrink-0 ml-2">
              {formatTime(secondsRemaining)}
            </span>
          </div>
        )}

        {/* WAIT Exact Timing Guidance Display */}
        {isWait && (
          <div className="bg-gray-900/80 border border-amber-500/30 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <span>⚠️</span>
                <span>Entry Protocol: PAUSED</span>
              </span>
              <span className="text-gray-400">• Probable Next: <b className={probableBias === 'CALL' ? 'text-emerald-400' : 'text-red-400'}>{probableBias} ({probablePct}%)</b></span>
            </div>
            <span className="font-mono text-gray-300 text-[11px]">
              Next Candle Open in <b className="text-amber-400">{formatTime(secondsRemaining)}</b>
            </span>
          </div>
        )}

        {/* Specs Table */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[11px] font-mono mt-0.5">
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/80">
            <span className="text-gray-500 block text-[10px]">Expiry:</span>
            <span className="text-gray-200 font-bold text-xs">
              {signal?.interval ? `${signal.interval.toUpperCase()} (Fixed)` : '1 Min (Fixed)'}
            </span>
          </div>
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/80">
            <span className="text-gray-500 block text-[10px]">Entry Moment:</span>
            <span className="text-amber-300 font-bold text-xs">Candle Open (0-15s)</span>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🤖 SMART AI ENSEMBLE ARBITER (Section 3)                   */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-gray-950/90 border border-blue-900/50 rounded-xl p-3.5 flex flex-col gap-2.5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-gray-200">
              🤖 Smart AI Ensemble (Independent Validation)
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/80">
            {signal.gemini_arbiter?.contradiction_detected
              ? 'Contradiction Rejected'
              : signal.gemini_arbiter?.provider
              ? 'AI Consensus Active'
              : 'Quantitative Engine Only'}
          </span>
        </div>

        {/* Model verification badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px] font-mono">
          <div className="bg-gray-900/80 border border-gray-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-gray-300 font-semibold">● Technical Engine:</span>
            <span className="text-emerald-400 font-bold">{score}/100 Pts</span>
          </div>
          <div className="bg-gray-900/80 border border-gray-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-gray-300 font-semibold">● Google Gemini:</span>
            <span className={clsx('font-bold', signal.gemini_arbiter?.models?.gemini?.status === 'active' ? 'text-emerald-400' : 'text-gray-500')}>
              {signal.gemini_arbiter?.models?.gemini?.status === 'active' ? 'Verified' : 'Unconfigured'}
            </span>
          </div>
          <div className="bg-gray-900/80 border border-gray-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-gray-300 font-semibold">● OpenAI GPT:</span>
            <span className={clsx('font-bold', signal.gemini_arbiter?.models?.openai?.status === 'active' ? 'text-emerald-400' : 'text-gray-500')}>
              {signal.gemini_arbiter?.models?.openai?.status === 'active' ? 'Verified' : 'Unconfigured'}
            </span>
          </div>
        </div>

        {/* AI Analysis text */}
        <p className="text-xs text-gray-200 bg-gray-900/90 p-2.5 rounded-lg border border-gray-800 leading-relaxed">
          💬 <b>Arbiter Verdict:</b>{' '}
          {signal.gemini_arbiter?.analysis_hi ||
            `Quantitative 100-point engine ne ${effectiveDirection} setup ko ${score}/100 score ke sath evaluate kiya hai. Market regime: ${regime}.`}
        </p>
      </div>

      {/* Model Confidence Meter */}
      <div className="w-full">
        <ConfidenceBar confidence={score} direction={effectiveDirection} />
      </div>

      {/* Disclaimers & Timestamp */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-800/60">
        <span>Signal Time: {format(new Date(signal.timestamp), 'HH:mm:ss')} UTC</span>
        <span>Confluence: {score}/100 Points</span>
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
                <h3 className="text-lg font-bold text-gray-100">Binomo Quantitative Protocol</h3>
                <p className="text-xs text-gray-400">Execution rules for maximum edge</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-gray-300 leading-relaxed">
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="font-semibold text-yellow-400 mb-1">1. Quantitative Setup Scores</p>
                <p>Scores are derived from 5 objective categories (Trend, Momentum, Price Action, MTF, Volatility). They represent setup confluence, not guaranteed financial profit.</p>
              </div>

              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="font-semibold text-yellow-400 mb-1">2. Entry Timing</p>
                <p>Execute immediately at the open of the candle (0-15 seconds window). Avoid entering mid-candle after momentum has already extended.</p>
              </div>

              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="font-semibold text-yellow-400 mb-1">3. Manual Execution Only</p>
                <p>Automatic real-money trading is disabled to protect capital. Review chart signals and execute trades manually on the official Binomo site.</p>
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
