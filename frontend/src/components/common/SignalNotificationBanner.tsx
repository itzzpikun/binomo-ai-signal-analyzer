// ============================================================
// src/components/common/SignalNotificationBanner.tsx
// High-visibility live signal pop-up notification with one-click Binomo trade execution
// Supports multi-asset live notifications across ALL 26 Binomo markets
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import type { Signal } from '../../types';
import type { MultiAssetSignal } from '../../services/api';
import { audioAlert } from '../../utils/audioAlert';

interface SignalNotificationBannerProps {
  currentSignal?: Signal | null;
  multiSignals?: MultiAssetSignal[];
  onSelectAsset?: (symbol: string) => void;
}

export const SignalNotificationBanner: React.FC<SignalNotificationBannerProps> = ({
  currentSignal,
  multiSignals = [],
  onSelectAsset,
}) => {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  });

  // Collect all actionable signals across current asset and scanned assets
  const actionableSignals: Array<{
    symbol: string;
    direction: 'CALL' | 'PUT';
    confidence: number;
    timestamp: string;
    isCurrent: boolean;
  }> = [];

  if (currentSignal && (currentSignal.direction === 'CALL' || currentSignal.direction === 'PUT')) {
    actionableSignals.push({
      symbol: currentSignal.symbol,
      direction: currentSignal.direction,
      confidence: currentSignal.confidence,
      timestamp: currentSignal.timestamp,
      isCurrent: true,
    });
  }

  for (const sig of multiSignals) {
    if (
      (sig.direction === 'CALL' || sig.direction === 'PUT') &&
      !actionableSignals.some((s) => s.symbol.toLowerCase() === sig.symbol.toLowerCase())
    ) {
      actionableSignals.push({
        symbol: sig.symbol,
        direction: sig.direction,
        confidence: sig.confidence,
        timestamp: sig.timestamp,
        isCurrent: false,
      });
    }
  }

  // Filter out dismissed
  const visibleSignals = actionableSignals.filter(
    (s) => !dismissedKeys.has(`${s.symbol}_${s.direction}_${s.timestamp.slice(0, 16)}`)
  );

  // Trigger audio alert for any newly discovered actionable signal
  useEffect(() => {
    for (const sig of visibleSignals) {
      const key = `${sig.symbol}_${sig.direction}_${sig.timestamp.slice(0, 16)}`;
      if (!notifiedKeysRef.current.has(key)) {
        notifiedKeysRef.current.add(key);
        audioAlert.notifySignal(sig.symbol, sig.direction, sig.confidence);
      }
    }
  }, [visibleSignals]);

  const handleEnableNotifications = () => {
    audioAlert.requestNotificationPermission();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') setHasPermission(true);
      });
    }
  };

  const handleDismiss = (key: string) => {
    setDismissedKeys((prev) => new Set(prev).add(key));
  };

  // If no actionable signals, show active scanner status bar
  if (visibleSignals.length === 0) {
    return (
      <div className="w-full flex items-center justify-between px-3 py-1 bg-gray-900/40 border-b border-gray-800/60 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-gray-300">
            26 Binomo OTC Markets Scanned Live
          </span>
          <span className="hidden sm:inline text-gray-500">•</span>
          <span className="text-gray-400 hidden sm:inline">
            Auto-notifies with sound whenever ANY market gets a CALL / PUT signal
          </span>
        </div>
        {!hasPermission && (
          <button
            onClick={handleEnableNotifications}
            className="text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>🔔 Enable Alerts</span>
          </button>
        )}
      </div>
    );
  }

  // Pick top featured signal: current asset if actionable, otherwise highest confidence
  const featured =
    visibleSignals.find((s) => s.isCurrent) ||
    [...visibleSignals].sort((a, b) => b.confidence - a.confidence)[0];

  const isCall = featured.direction === 'CALL';
  const featuredKey = `${featured.symbol}_${featured.direction}_${featured.timestamp.slice(0, 16)}`;

  return (
    <div
      className={`w-full p-2.5 sm:p-3 border-b shadow-xl transition-all duration-300 animate-bounce-short ${
        isCall
          ? 'bg-gradient-to-r from-emerald-950 via-emerald-900/90 to-gray-900 border-emerald-500/80 shadow-emerald-900/40'
          : 'bg-gradient-to-r from-red-950 via-red-900/90 to-gray-900 border-red-500/80 shadow-red-900/40'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        {/* Main Banner row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Left: Signal Badge & Info */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg flex-shrink-0 animate-pulse ${
                isCall ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
              }`}
            >
              {isCall ? '▲' : '▼'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/50 text-yellow-300 border border-yellow-500/50">
                  🔔 LIVE SIGNAL DETECTED
                </span>
                <span className="text-white font-black text-sm tracking-wide">
                  {featured.symbol}
                </span>
                <span
                  className={`text-xs font-black px-2 py-0.5 rounded ${
                    isCall ? 'bg-emerald-400 text-black' : 'bg-red-500 text-white'
                  }`}
                >
                  {featured.direction} ({featured.confidence}% Confidence)
                </span>
                {!featured.isCurrent && onSelectAsset && (
                  <button
                    onClick={() => onSelectAsset(featured.symbol)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-600/60 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-400/40 transition-colors"
                  >
                    View Chart →
                  </button>
                )}
              </div>
              <p className="text-gray-200 text-xs font-medium mt-0.5">
                ⏱️ <b>15s Candle Open Entry Window Active!</b>{' '}
                {isCall ? 'Execute CALL (Higher / Green)' : 'Execute PUT (Lower / Red)'} on Binomo.
              </p>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <a
              href="https://binomo.com/trading"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => audioAlert.requestNotificationPermission()}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/30 transition-transform active:scale-95"
            >
              <span>⚡ TRADE ON BINOMO NOW</span>
              <span>↗</span>
            </a>
            <button
              onClick={() => handleDismiss(featuredKey)}
              className="px-2.5 py-2 text-gray-400 hover:text-white bg-black/40 rounded-xl text-xs hover:bg-black/60 transition-colors"
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Multi-Asset Quick Switch Strip (if more signals active) */}
        {visibleSignals.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-thin text-xs border-t border-white/10">
            <span className="text-[10px] uppercase font-bold text-gray-400 flex-shrink-0">
              Other Active Markets ({visibleSignals.length - 1}):
            </span>
            {visibleSignals
              .filter((s) => s.symbol !== featured.symbol)
              .map((s) => {
                const sCall = s.direction === 'CALL';
                return (
                  <button
                    key={`${s.symbol}_${s.direction}`}
                    onClick={() => onSelectAsset && onSelectAsset(s.symbol)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all border ${
                      sCall
                        ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-800'
                        : 'bg-red-950/70 border-red-500/50 text-red-300 hover:bg-red-800'
                    }`}
                  >
                    <span>{sCall ? '▲' : '▼'}</span>
                    <span>{s.symbol}</span>
                    <span className="opacity-80 font-mono text-[10px]">
                      {s.direction} {s.confidence}%
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SignalNotificationBanner;
