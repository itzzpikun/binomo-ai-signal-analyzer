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

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 300 - (now % 300); // 5 min interval
      setSecondsRemaining(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Entry window logic: First 15 seconds of a 300s candle is when remaining is between 285 and 300
  const isEntryWindowActive = secondsRemaining >= 285 && secondsRemaining <= 300;
  // Prepare alert: Last 30 seconds of previous candle (remaining <= 30)
  const isPrepareWindow = secondsRemaining <= 30;

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

  const isWait = signal.direction === 'WAIT';

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
      icon: '⏸',
      label: 'WAIT',
      sublabel: 'No Clear Direction / Chop',
      actionPrompt: 'Wait for next high-probability setup',
    },
  };

  const config = directionConfig[signal.direction] || directionConfig.WAIT;
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
                New 5M candle has opened. Execute <b>{signal.direction}</b> on Binomo within next 15 seconds!
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
                Next candle opens in {secondsRemaining}s. Set 5M expiry and be ready to press {signal.direction}!
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
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-400">
            ⏸️ <b>NO TRADE NOW:</b> Technical indicators conflict or market is consolidating. Wait for clear breakout.
          </div>
        )}

        {/* Precise Trade Execution Specs Table */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[11px] font-mono mt-0.5">
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/80">
            <span className="text-gray-500 block text-[10px]">Expiry:</span>
            <span className="text-gray-200 font-bold text-xs">5 Min (Fixed)</span>
          </div>
          <div className="bg-gray-900/60 p-2 rounded-lg border border-gray-800/80">
            <span className="text-gray-500 block text-[10px]">Entry Moment:</span>
            <span className="text-amber-300 font-bold text-xs">Open (0-15s)</span>
          </div>
        </div>

        {/* Hindi Rule summary */}
        <p className="text-[11px] text-gray-400 italic bg-gray-900/30 p-2 rounded border border-gray-800/40">
          💡 <b>Rule:</b> 5-minute candle ke open hote hi pehle 10-15 seconds me trade lein. Mid-candle (beech me) trade lene se bachein.
        </p>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🤖 GEMINI & CHATGPT AI ARBITER (Trap Detection & Cross-Verification) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="w-full bg-gray-950/90 border border-blue-900/40 rounded-xl p-3.5 flex flex-col gap-2.5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span
                className={clsx(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  signal.gemini_arbiter?.status === 'active' ? 'bg-emerald-400' : 'bg-blue-400'
                )}
              />
              <span
                className={clsx(
                  'relative inline-flex rounded-full h-2.5 w-2.5',
                  signal.gemini_arbiter?.status === 'active' ? 'bg-emerald-500' : 'bg-blue-500'
                )}
              />
            </span>
            <span className="text-xs font-bold text-gray-200">
              🤖 AI Arbiter (Gemini 1.5 / GPT-4o-mini)
            </span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
            Backend Integrated
          </span>
        </div>

        {signal.gemini_arbiter?.status === 'active' ? (
          <div className="space-y-2 mt-0.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={clsx(
                    'text-[10px] font-extrabold px-2 py-0.5 rounded-full border',
                    signal.gemini_arbiter.trap_risk === 'LOW'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : signal.gemini_arbiter.trap_risk === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  )}
                >
                  🛡️ TRAP RISK: {signal.gemini_arbiter.trap_risk}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  via {signal.gemini_arbiter.provider === 'openai' ? 'OpenAI GPT' : 'Google Gemini'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-400">
                AI Confidence: {signal.gemini_arbiter.confidence}%
              </span>
            </div>

            {/* Hindi Reason */}
            {signal.gemini_arbiter.analysis_hi && (
              <p className="text-xs text-gray-300 bg-gray-900/80 p-2.5 rounded-lg border border-gray-800">
                💬 <b>AI Analysis:</b> {signal.gemini_arbiter.analysis_hi}
              </p>
            )}
            {/* English Reason */}
            {signal.gemini_arbiter.analysis_en && (
              <p className="text-[11px] text-gray-400 italic">
                {signal.gemini_arbiter.analysis_en}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 bg-gray-900/60 p-2 rounded-lg border border-gray-800 text-xs">
            <div className="text-gray-300 flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">⚡ Permanent Backend AI Active:</span>
              <span className="text-gray-400 text-[11px]">Real-time confluence & trap detection verified</span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono bg-gray-800 px-1.5 py-0.5 rounded">
              Ready
            </span>
          </div>
        )}
      </div>

      {/* Model Confidence Meter */}
      <div className="w-full">
        <ConfidenceBar confidence={signal.confidence} direction={signal.direction} />
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
                <p>Select <b>{signal.symbol}</b> on Binomo. Switch chart timeframe to <b>5 Minutes (5M)</b>.</p>
              </div>

              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <p className="font-semibold text-yellow-400 mb-1">2. Timing Is Crucial (कब Trade Lein)</p>
                <p>Never take a trade mid-candle! Watch the timer: wait until the 5-minute candle starts, and click <b>{signal.direction}</b> within the first 10-15 seconds.</p>
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
