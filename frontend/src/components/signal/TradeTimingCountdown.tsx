import React, { useState, useEffect } from 'react';
import type { Signal } from '../../types';

interface TradeTimingCountdownProps {
  interval: string;
  currentSignal?: Signal | null;
}

export const TradeTimingCountdown: React.FC<TradeTimingCountdownProps> = ({
  interval,
  currentSignal,
}) => {
  const intervalSeconds = interval === '1min' ? 60 : interval === '15min' ? 900 : 300;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return intervalSeconds - (now % intervalSeconds);
  });

  const [elapsedInCandle, setElapsedInCandle] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return now % intervalSeconds;
  });

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now % intervalSeconds;
      setElapsedInCandle(elapsed);
      setSecondsRemaining(intervalSeconds - elapsed);
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [intervalSeconds]);

  const formatMMSS = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // State phases:
  // 1. ENTRY_WINDOW_OPEN: First 15 seconds of candle open (elapsed <= 15)
  // 2. GET_READY: Last 12 seconds before candle close (secondsRemaining <= 12)
  // 3. WAITING: Middle of candle
  const isEntryWindowOpen = elapsedInCandle <= 15;
  const isGetReady = !isEntryWindowOpen && secondsRemaining <= 12;

  const direction =
    (currentSignal?.direction === 'CALL' || currentSignal?.direction === 'PUT') && (currentSignal?.confidence || 0) >= 70
      ? currentSignal.direction
      : 'WAIT';
  const confidence = currentSignal?.confidence || 0;
  const isCall = direction === 'CALL';
  const isPut = direction === 'PUT';

  // Calculate next candle open clock time
  const nextOpenDate = new Date(Date.now() + secondsRemaining * 1000);
  const nextOpenTimeStr = nextOpenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Progress percentage of current candle
  const progressPct = Math.min(100, Math.max(0, ((intervalSeconds - secondsRemaining) / intervalSeconds) * 100));

  return (
    <div
      className={`rounded-2xl p-3 sm:p-4 border shadow-xl transition-all duration-300 relative overflow-hidden ${
        isEntryWindowOpen
          ? isCall
            ? 'bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-gray-950 border-emerald-500 shadow-emerald-500/20'
            : isPut
            ? 'bg-gradient-to-r from-red-950/80 via-red-900/60 to-gray-950 border-red-500 shadow-red-500/20'
            : 'bg-gradient-to-r from-amber-950/80 via-amber-900/50 to-gray-950 border-amber-500/80'
          : isGetReady
          ? 'bg-gradient-to-r from-amber-950/70 via-gray-900 to-gray-950 border-amber-500/70 animate-pulse'
          : 'bg-[#121622]/95 border-gray-800'
      }`}
    >
      {/* Background glowing glow for active window */}
      {isEntryWindowOpen && (
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        {/* Left column: Status headline & entry rule */}
        <div className="flex items-start sm:items-center gap-3">
          {/* Animated circular indicator */}
          <div className="relative flex-shrink-0 mt-0.5 sm:mt-0">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex flex-col items-center justify-center font-mono font-black text-xs sm:text-sm border shadow-md transition-all ${
                isEntryWindowOpen
                  ? isCall
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-emerald-500/40 animate-bounce'
                    : isPut
                    ? 'bg-red-500 text-white border-red-300 shadow-red-500/40 animate-bounce'
                    : 'bg-amber-500 text-black border-amber-300'
                  : isGetReady
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 animate-pulse'
                  : 'bg-gray-800/90 text-gray-200 border-gray-700'
              }`}
            >
              <span className="text-[10px] leading-none opacity-80 uppercase font-sans">
                {isEntryWindowOpen ? 'OPEN' : 'TICK'}
              </span>
              <span className="text-base sm:text-lg font-black leading-tight">
                {isEntryWindowOpen ? `${15 - elapsedInCandle}s` : formatMMSS(secondsRemaining)}
              </span>
            </div>
            {isEntryWindowOpen && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                ⏱️ Binomo Entry Timing
              </span>

              {isEntryWindowOpen ? (
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  isCall ? 'bg-emerald-500 text-black animate-pulse' : isPut ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-400 text-black'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  🔥 ENTRY WINDOW ACTIVE NOW!
                </span>
              ) : isGetReady ? (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-400 text-black animate-pulse">
                  🚨 GET READY! NEXT CANDLE IN {secondsRemaining}s
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 font-medium">
                  Next Candle Open: <strong className="text-gray-200 font-mono">{nextOpenTimeStr}</strong>
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm font-bold text-gray-100 mt-1">
              {isEntryWindowOpen
                ? direction !== 'WAIT'
                  ? `👉 Take ${direction} trade right now! Candle just opened (First 15s entry window).`
                  : 'Candle open window active — wait for confirmed setup.'
                : isGetReady
                ? `Prepare Binomo screen! Enter ${direction !== 'WAIT' ? direction : 'trade'} precisely as candle opens.`
                : `Enter trades only in the first 15 seconds of candle open (00:00 - 00:15).`}
            </p>

            <span className="text-[11px] text-gray-400 block mt-0.5">
              Rule: <span className="text-yellow-400 font-semibold">Candle Open 15-Sec Rule</span> • Suggested Expiry: <strong className="text-gray-200">{interval === '1min' ? '1 Min' : '5 Mins'} (Fixed)</strong>
            </span>
          </div>
        </div>

        {/* Right column: Target Signal Direction badge & Binomo Link */}
        <div className="flex items-center gap-2.5 sm:self-center justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-800">
          <div className="text-right">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Model Signal</span>
            <span
              className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${
                isCall
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : isPut
                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}
            >
              <span>{isCall ? 'CALL (BUY) ↗' : isPut ? 'PUT (SELL) ↘' : 'WAIT (CHOP)'}</span>
              {direction !== 'WAIT' && (
                <span className="font-mono text-[11px] font-bold">({confidence}%)</span>
              )}
            </span>
          </div>

          <a
            href="https://binomo.com/trading"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-black text-xs shadow-lg shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
          >
            <span>Open Binomo</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Candle Duration Progress Bar */}
      <div className="w-full bg-gray-800/80 h-1.5 rounded-full overflow-hidden mt-2.5 relative">
        <div
          className={`h-full transition-all duration-1000 rounded-full ${
            isEntryWindowOpen
              ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
              : isGetReady
              ? 'bg-amber-400'
              : 'bg-blue-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
        {/* Entry window marker at 15s */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
          style={{ left: `${(15 / intervalSeconds) * 100}%` }}
          title="15s Entry Window Boundary"
        />
      </div>
    </div>
  );
};

export default TradeTimingCountdown;
