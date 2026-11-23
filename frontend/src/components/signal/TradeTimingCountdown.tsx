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
  // 1. ENTRY_WINDOW_OPEN: First 10 seconds of candle open (elapsed <= 10)
  // 2. GET_READY: Last 10 seconds before candle close (secondsRemaining <= 10)
  // 3. LATE_WINDOW: Middle of candle (10s elapsed to 10s remaining) — LATE ENTRY STRICTLY BLOCKED!
  const isEntryWindowOpen = elapsedInCandle <= 10;
  const isGetReady = !isEntryWindowOpen && secondsRemaining <= 10;
  const isLateWindow = !isEntryWindowOpen && !isGetReady;

  const direction =
    (currentSignal?.direction === 'CALL' || currentSignal?.direction === 'PUT') && (currentSignal?.confidence || 0) >= 65
      ? currentSignal.direction
      : 'WAIT';
  const confidence = currentSignal?.confidence || 0;
  const isCall = direction === 'CALL';
  const isPut = direction === 'PUT';

  const probableSetup = currentSignal?.next_probable_setup;
  const probableBias = probableSetup?.bias || 'CALL';
  const probablePct = probableSetup?.biasPercentage || 60;

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
          : direction !== 'WAIT'
          ? 'bg-gradient-to-r from-rose-950/40 via-gray-900 to-gray-950 border-rose-500/40'
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
                  : isLateWindow && direction !== 'WAIT'
                  ? 'bg-rose-900/40 text-rose-300 border-rose-600/60'
                  : 'bg-gray-800/90 text-gray-200 border-gray-700'
              }`}
            >
              <span className="text-[10px] leading-none opacity-80 uppercase font-sans">
                {isEntryWindowOpen ? 'OPEN' : isLateWindow && direction !== 'WAIT' ? 'LOCK' : 'TICK'}
              </span>
              <span className="text-base sm:text-lg font-black leading-tight">
                {isEntryWindowOpen ? `${10 - elapsedInCandle}s` : formatMMSS(secondsRemaining)}
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
                  🔥 ENTRY WINDOW ACTIVE NOW (0-10s)!
                </span>
              ) : isGetReady ? (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-400 text-black animate-pulse">
                  🚨 GET READY! NEXT CANDLE IN {secondsRemaining}s
                </span>
              ) : isLateWindow && direction !== 'WAIT' ? (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <span>⛔</span>
                  <span>MID-CANDLE LATE ENTRY BLOCKED</span>
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 font-medium">
                  Next Candle Open: <strong className="text-gray-200 font-mono">{nextOpenTimeStr}</strong>
                </span>
              )}

              {direction === 'WAIT' && (
                <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                  probableBias === 'CALL'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  <span>🔮 Developing: {probableBias} ({probablePct}%)</span>
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm font-bold text-gray-100 mt-1">
              {isEntryWindowOpen
                ? direction !== 'WAIT'
                  ? `👉 Take ${direction} trade right now! Candle just opened (First 10s entry window).`
                  : `👉 Candle open window: Status is WAIT (Developing towards ${probableBias} ${probablePct}%). Await confirmation.`
                : isGetReady
                ? direction !== 'WAIT'
                  ? `Prepare Binomo screen! Enter ${direction} precisely as candle opens in ${secondsRemaining}s.`
                  : `🚨 Next candle in ${secondsRemaining}s! Market leaning towards ${probableBias} (${probablePct}%). Prepare screen but enter only on 65%+ confirmation.`
                : isLateWindow && direction !== 'WAIT'
                ? `⛔ DO NOT ENTER NOW! Candle already ran ${elapsedInCandle}s. Entering mid-candle leads to wick losses. Wait for next candle open in ${formatMMSS(secondsRemaining)}.`
                : `Status: WAIT • Market developing towards ${probableBias} (${probablePct}%). Next candle opens at ${nextOpenTimeStr}.`}
            </p>

            <span className="text-[11px] text-gray-400 block mt-0.5">
              Rule: <span className="text-yellow-400 font-semibold">Candle Open 10-Sec Rule</span> • Suggested Expiry: <strong className="text-gray-200">{interval === '1min' ? '1 Min' : '5 Mins'} (Fixed)</strong>
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
                  ? isLateWindow
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 opacity-80'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                  : isPut
                  ? isLateWindow
                    ? 'bg-red-950/60 text-red-300 border-red-500/40 opacity-80'
                    : 'bg-red-500/20 text-red-300 border-red-500/60'
                  : probableBias === 'CALL'
                  ? 'bg-amber-500/10 text-amber-300 border-emerald-500/40'
                  : 'bg-amber-500/10 text-amber-300 border-red-500/40'
              }`}
            >
              <span>{isCall ? (isLateWindow ? '▲ CALL (Locked)' : '▲ CALL') : isPut ? (isLateWindow ? '▼ PUT (Locked)' : '▼ PUT') : `⚠️ WAIT (${probableBias} ${probablePct}%)`}</span>
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
        {/* Entry window marker at 10s */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
          style={{ left: `${(10 / intervalSeconds) * 100}%` }}
          title="10s Entry Window Boundary"
        />
      </div>

      {/* Binomo Zero-Loss Strategy Guidance Note */}
      <div className="mt-2 pt-2 border-t border-gray-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-400 gap-1">
        <span className="flex items-center gap-1 text-yellow-400 font-bold">
          <span>💡</span>
          <span>Binomo Pro Tip:</span>
        </span>
        <span className="text-gray-300">
          Candle ke beech me trade lene se loss hota hai. Hamesha candle shuru hone ke pehle <b>0-10 second</b> me hi trade enter karein.
        </span>
      </div>
    </div>
  );
};

export default TradeTimingCountdown;
