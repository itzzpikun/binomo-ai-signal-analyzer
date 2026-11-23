// ============================================================
// src/components/common/SignalNotificationBanner.tsx
// High-visibility live signal pop-up notification with one-click Binomo trade execution
// ============================================================
import React, { useState, useEffect } from 'react';
import type { Signal } from '../../types';
import { audioAlert } from '../../utils/audioAlert';

interface SignalNotificationBannerProps {
  signal: Signal | null;
}

export const SignalNotificationBanner: React.FC<SignalNotificationBannerProps> = ({ signal }) => {
  const [dismissedKey, setDismissedKey] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  });

  const signalKey = signal ? `${signal.symbol}_${signal.direction}_${signal.timestamp}` : '';
  const isVisible = signal && signal.direction !== 'WAIT' && dismissedKey !== signalKey;

  useEffect(() => {
    if (signal && signal.direction !== 'WAIT') {
      audioAlert.notifySignal(signal.symbol, signal.direction, signal.confidence);
    }
  }, [signal?.direction, signal?.symbol, signal?.timestamp, signal?.confidence]);

  const handleEnableNotifications = () => {
    audioAlert.requestNotificationPermission();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') setHasPermission(true);
      });
    }
  };

  if (!isVisible || !signal) {
    return (
      <div className="w-full flex items-center justify-between px-3 py-1 bg-gray-900/40 border-b border-gray-800/60 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Signal Scanner Active • Auto-notifies instantly on CALL / PUT</span>
        </div>
        {!hasPermission && (
          <button
            onClick={handleEnableNotifications}
            className="text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>🔔 Enable Sound & Desktop Alerts</span>
          </button>
        )}
      </div>
    );
  }

  const isCall = signal.direction === 'CALL';

  return (
    <div
      className={`w-full p-2.5 sm:p-3 border-b shadow-xl transition-all duration-300 animate-bounce-short ${
        isCall
          ? 'bg-gradient-to-r from-emerald-950 via-emerald-900/90 to-gray-900 border-emerald-500/80 shadow-emerald-900/40'
          : 'bg-gradient-to-r from-red-950 via-red-900/90 to-gray-900 border-red-500/80 shadow-red-900/40'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
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
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/40 text-yellow-300 border border-yellow-500/40">
                🔔 NEW LIVE SIGNAL
              </span>
              <span className="text-white font-black text-sm tracking-wide">
                {signal.symbol}
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded ${
                  isCall ? 'bg-emerald-400 text-black' : 'bg-red-500 text-white'
                }`}
              >
                {signal.direction} ({signal.confidence}% Confidence)
              </span>
            </div>
            <p className="text-gray-200 text-xs font-medium mt-0.5">
              ⏱️ <b>15s Candle Open Entry Window Active!</b> {isCall ? 'Place Higher / Buy on Binomo' : 'Place Lower / Sell on Binomo'}
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
            onClick={() => setDismissedKey(signalKey)}
            className="px-2.5 py-2 text-gray-400 hover:text-white bg-black/40 rounded-xl text-xs hover:bg-black/60 transition-colors"
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignalNotificationBanner;
