// ============================================================
// src/components/common/SignalNotificationBanner.tsx
// High-visibility live signal pop-up notification with one-click Binomo trade execution
// THRESHOLD: 65% — shows CALL/PUT when model confidence >= 65%
// ALL-ASSETS ALERT: notifies when ALL 26 assets have confidence >= 65% on any timeframe
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import type { Signal } from '../../types';
import type { MultiAssetSignal } from '../../services/api';
import { audioAlert } from '../../utils/audioAlert';

const MIN_CONFIDENCE = 65;
const TOTAL_ASSETS = 26;

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
  const [allAssetsAlert, setAllAssetsAlert] = useState<boolean>(false);
  const [qualifiedCount, setQualifiedCount] = useState<number>(0);
  const seenSignalsRef = useRef<Set<string>>(new Set());
  const allAssetsSeenRef = useRef<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const allAssetsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  });

  // Check for newly arriving signals (only fresh and confidence >= 65%)
  useEffect(() => {
    const now = Date.now();
    const confirmedCandidates: TripleConfirmedAlert[] = [];

    const effCurrentDir: ('CALL' | 'PUT' | null) =
      (currentSignal?.direction === 'CALL' || currentSignal?.direction === 'PUT') && currentSignal.confidence >= MIN_CONFIDENCE
        ? currentSignal.direction
        : null;

    // 1. Current viewed asset (check if accuracy >= 65%)
    if (
      currentSignal &&
      effCurrentDir &&
      currentSignal.confidence >= MIN_CONFIDENCE
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

    // 2. Scanned multi-assets (accuracy >= 65%)
    for (const sig of multiSignals) {
      if (
        (sig.direction === 'CALL' || sig.direction === 'PUT') &&
        sig.confidence >= MIN_CONFIDENCE
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

    // Find the latest, unseen confirmed signal
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

    // ── ALL 26 ASSETS >= 65% CHECK ──────────────────────────────
    // Count unique assets with confidence >= 65% from multiSignals
    const qualifiedAssets = new Set<string>();
    for (const sig of multiSignals) {
      if (
        (sig.direction === 'CALL' || sig.direction === 'PUT') &&
        sig.confidence >= MIN_CONFIDENCE
      ) {
        qualifiedAssets.add(sig.symbol);
      }
    }
    // Also count current signal
    if (currentSignal && effCurrentDir && currentSignal.confidence >= MIN_CONFIDENCE) {
      qualifiedAssets.add(currentSignal.symbol);
    }

    setQualifiedCount(qualifiedAssets.size);

    // If ALL 26 assets meet threshold, trigger the mega-alert
    if (qualifiedAssets.size >= TOTAL_ASSETS) {
      const alertKey = `all_${TOTAL_ASSETS}_${new Date().toISOString().slice(0, 16)}`;
      if (allAssetsSeenRef.current !== alertKey) {
        allAssetsSeenRef.current = alertKey;
        setAllAssetsAlert(true);
        audioAlert.notifySignal('ALL ASSETS', 'CALL', 100);

        // Send browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🚀 ALL 26 ASSETS ≥ 65% CONFIDENCE!', {
            body: `All ${TOTAL_ASSETS} tracked assets have model confidence ≥ ${MIN_CONFIDENCE}%. High-probability market condition detected!`,
            icon: '📊',
          });
        }

        if (allAssetsTimerRef.current) clearTimeout(allAssetsTimerRef.current);
        allAssetsTimerRef.current = setTimeout(() => {
          setAllAssetsAlert(false);
        }, 60_000);
      }
    }
  }, [currentSignal, multiSignals]);

  // Cleanup auto-dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (allAssetsTimerRef.current) clearTimeout(allAssetsTimerRef.current);
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

  const handleDismissAllAssets = () => {
    if (allAssetsTimerRef.current) clearTimeout(allAssetsTimerRef.current);
    setAllAssetsAlert(false);
  };

  return (
    <>
      {/* ── ALL 26 ASSETS >= 65% MEGA ALERT ────────────────────── */}
      {allAssetsAlert && (
        <div className="w-full p-3 sm:p-4 border-b shadow-2xl bg-gradient-to-r from-purple-950 via-indigo-900 to-purple-950 border-purple-500/80 shadow-purple-900/40 animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl bg-purple-500 text-white shadow-lg animate-bounce">
                🚀
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-black/60 text-yellow-300 border border-yellow-500/60">
                    ⚡ ALL {TOTAL_ASSETS} ASSETS ≥ {MIN_CONFIDENCE}% CONFIDENCE
                  </span>
                </div>
                <p className="text-purple-100 text-xs font-bold mt-0.5">
                  🔥 Extreme market condition detected! All tracked assets are showing high-probability setups!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://binomo.com/trading"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition-transform active:scale-95"
              >
                ⚡ TRADE NOW ↗
              </a>
              <button
                onClick={handleDismissAllAssets}
                className="px-2.5 py-2 text-gray-400 hover:text-white bg-black/40 rounded-xl text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INDIVIDUAL SIGNAL ALERT ────────────────────────────── */}
      {activeAlert ? (
        <div
          className={`w-full p-2.5 sm:p-3 border-b shadow-xl transition-all duration-300 animate-bounce-short ${
            activeAlert.direction === 'CALL'
              ? 'bg-gradient-to-r from-emerald-950 via-emerald-900/90 to-gray-900 border-emerald-500/80 shadow-emerald-900/40'
              : 'bg-gradient-to-r from-red-950 via-red-900/90 to-gray-900 border-red-500/80 shadow-red-900/40'
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shadow-lg flex-shrink-0 animate-pulse ${
                  activeAlert.direction === 'CALL' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
                }`}
              >
                {activeAlert.direction === 'CALL' ? '▲' : '▼'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/60 text-yellow-300 border border-yellow-500/60 flex items-center gap-1">
                    <span>🔥</span>
                    <span>CONFIRMED: {activeAlert.direction} ({activeAlert.confidence}%)</span>
                  </span>
                  <span className="text-white font-black text-sm tracking-wide">
                    {activeAlert.symbol}
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
                  ⏱️ <b>Model Confidence ≥ {MIN_CONFIDENCE}%!</b>{' '}
                  {activeAlert.direction === 'CALL' ? 'Execute CALL (Higher / Green)' : 'Execute PUT (Lower / Red)'} on Binomo within open window.
                </p>
              </div>
            </div>

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
      ) : (
        /* ── IDLE STATUS BAR ────────────────────────────────────── */
        <div className="w-full flex items-center justify-between px-3 py-1 bg-gray-900/40 border-b border-gray-800/60 text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-gray-300">
              ⚡ AI Signal Engine Active (≥{MIN_CONFIDENCE}% Confirmed Filter)
            </span>
            <span className="hidden sm:inline text-gray-500">•</span>
            <span className="text-gray-400 hidden sm:inline">
              Auto-notifies when Model Confidence reaches ≥{MIN_CONFIDENCE}% for verified CALL / PUT entries
            </span>
            {qualifiedCount > 0 && (
              <>
                <span className="hidden sm:inline text-gray-500">•</span>
                <span className={`font-mono font-bold ${qualifiedCount >= TOTAL_ASSETS ? 'text-purple-400 animate-pulse' : qualifiedCount >= 10 ? 'text-emerald-400' : 'text-blue-400'}`}>
                  {qualifiedCount}/{TOTAL_ASSETS} Assets Active
                </span>
              </>
            )}
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
      )}
    </>
  );
};

export default SignalNotificationBanner;
