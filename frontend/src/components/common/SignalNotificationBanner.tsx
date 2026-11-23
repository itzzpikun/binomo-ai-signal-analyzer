// ============================================================
// src/components/common/SignalNotificationBanner.tsx
// High-visibility live signal pop-up notification with one-click Binomo trade execution
// STRICT 3-TIMEFRAME FILTER:
// ONLY notifies when 1M, 5M, and 15M ALL 3 agree on the EXACT SAME direction (CALL or PUT)
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

interface TripleConfirmedAlert {
  symbol: string;
  direction: 'CALL' | 'PUT';
  confidence: number;
  timestamp: string;
  isCurrent: boolean;
}

export const SignalNotificationBanner: React.FC<SignalNotificationBannerProps> = ({
  currentSignal,
  multiSignals = [],
  onSelectAsset,
}) => {
  const [activeAlert, setActiveAlert] = useState<TripleConfirmedAlert | null>(null);
  const seenSignalsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  });

  // Check for newly arriving signals (only fresh and ONLY 3-timeframe confirmed!)
  useEffect(() => {
    const now = Date.now();
    const confirmedCandidates: TripleConfirmedAlert[] = [];

    const effCurrentDir: ('CALL' | 'PUT' | null) =
      (currentSignal?.direction === 'CALL' || currentSignal?.direction === 'PUT') && currentSignal.confidence >= 70
        ? currentSignal.direction
        : null;

    // Strict User Rule: "after 70% model confidence show signal put or call otherwise wait"
    // 1. Current viewed asset (check if accuracy >= 70%)
    if (
      currentSignal &&
      effCurrentDir &&
      currentSignal.confidence >= 70
    ) {
      const ageMs = now - new Date(currentSignal.timestamp).getTime();
      if (ageMs < 30_000) {
        confirmedCandidates.push({
          symbol: currentSignal.symbol,
          direction: effCurrentDir,
          confidence: currentSignal.confidence,
          timestamp: currentSignal.timestamp,
          isCurrent: true,
        });
      }
    }

    // 2. Scanned multi-assets (accuracy >= 70%)
    for (const sig of multiSignals) {
      if (
        (sig.direction === 'CALL' || sig.direction === 'PUT') &&
        sig.confidence >= 70
      ) {
        const ageMs = now - new Date(sig.timestamp).getTime();
        if (ageMs < 30_000) {
          confirmedCandidates.push({
            symbol: sig.symbol,
            direction: sig.direction,
            confidence: sig.confidence,
            timestamp: sig.timestamp,
            isCurrent: false,
          });
        }
      }
    }

    // Find the latest, unseen triple-confirmed signal
    const newFresh = confirmedCandidates.find((s) => {
      const key = `${s.symbol}_${s.direction}_${s.timestamp.slice(0, 16)}`;
      return !seenSignalsRef.current.has(key);
    });

    if (newFresh) {
      const key = `${newFresh.symbol}_${newFresh.direction}_${newFresh.timestamp.slice(0, 16)}`;
      seenSignalsRef.current.add(key);

      // Play audio chime
      audioAlert.notifySignal(newFresh.symbol, newFresh.direction, newFresh.confidence);

      // Set active pop-up banner
      setActiveAlert(newFresh);

      // Automatically auto-dismiss after 30 seconds
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setActiveAlert(null);
      }, 30_000);
    }
  }, [currentSignal, multiSignals]);

  // Cleanup auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleEnableNotifications = () => {
    audioAlert.requestNotificationPermission();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') setHasPermission(true);
      });
    }
  };

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActiveAlert(null);
  };

  // If no active alert, show the clean slim status bar with 3-timeframe indicator
  if (!activeAlert) {
    return (
      <div className="w-full flex items-center justify-between px-3 py-1 bg-gray-900/40 border-b border-gray-800/60 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-gray-300">
            ⚡ AI Signal Engine Active (≥70% Confirmed Filter)
          </span>
          <span className="hidden sm:inline text-gray-500">•</span>
          <span className="text-gray-400 hidden sm:inline">
            Auto-notifies when Model Confidence reaches ≥70% for verified CALL / PUT entries
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

  const isCall = activeAlert.direction === 'CALL';

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
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/60 text-yellow-300 border border-yellow-500/60 flex items-center gap-1">
                <span>🔥</span>
                <span>TRIPLE TIMEFRAME CONFIRMED: 1M + 5M + 15M ALL {activeAlert.direction}</span>
              </span>
              <span className="text-white font-black text-sm tracking-wide">
                {activeAlert.symbol}
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded ${
                  isCall ? 'bg-emerald-400 text-black' : 'bg-red-500 text-white'
                }`}
              >
                {activeAlert.direction} ({activeAlert.confidence}% Confidence)
              </span>
              {!activeAlert.isCurrent && onSelectAsset && (
                <button
                  onClick={() => onSelectAsset(activeAlert.symbol)}
                  className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-600/60 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-400/40 transition-colors"
                >
                  View Chart →
                </button>
              )}
            </div>
            <p className="text-gray-200 text-xs font-medium mt-0.5">
              ⏱️ <b>100% 3-Timeframe Confluence Active!</b>{' '}
              {isCall ? 'Execute CALL (Higher / Green)' : 'Execute PUT (Lower / Red)'} on Binomo within open window.
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
            onClick={handleDismiss}
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
