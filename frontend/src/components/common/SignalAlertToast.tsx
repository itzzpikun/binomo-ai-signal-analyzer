// ============================================================
// src/components/common/SignalAlertToast.tsx
// High-confidence (>=75%) signal toast with audio chime alert
// ============================================================
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { soundService } from '../../services/soundService';
import { notificationService } from '../../services/notificationService';

export const SignalAlertToast: React.FC = () => {
  const activeAlert = useAppStore((s) => s.activeAlert);
  const setActiveAlert = useAppStore((s) => s.setActiveAlert);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);

  const [progress, setProgress] = useState<number>(100);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!activeAlert) return;

    setProgress(100);
    const start = Date.now();
    const duration = 8000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setActiveAlert(null);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [activeAlert, setActiveAlert]);

  if (!activeAlert) return null;

  const isCall = activeAlert.direction === 'CALL';
  const isPut = activeAlert.direction === 'PUT';

  const handleSwitchSymbol = () => {
    if (activeAlert.symbol && activeAlert.symbol !== selectedSymbol) {
      setSelectedSymbol(activeAlert.symbol);
    }
    setActiveAlert(null);
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full mx-auto p-1 animate-in fade-in slide-in-from-top-4 duration-300">
      <div
        className={`rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${
          isCall
            ? 'bg-emerald-950/95 border-emerald-500/70 shadow-emerald-500/20 text-emerald-100'
            : isPut
            ? 'bg-red-950/95 border-red-500/70 shadow-red-500/20 text-red-100'
            : 'bg-yellow-950/95 border-yellow-500/70 shadow-yellow-500/20 text-yellow-100'
        }`}
      >
        {/* Progress bar */}
        <div className="w-full bg-black/40 h-1">
          <div
            className={`h-full transition-all duration-100 ${
              isCall ? 'bg-emerald-400' : isPut ? 'bg-red-400' : 'bg-yellow-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-3.5 flex flex-col gap-2.5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isCall ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    isCall ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
              </span>
              <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 flex-wrap">
                <span>🚨 HIGH CONFLUENCE ALERT</span>
                <span className="font-mono text-amber-300 font-bold bg-black/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                  {activeAlert.confluence_score ?? activeAlert.confidence}%
                </span>
                {activeAlert.source === 'simulated' && (
                  <span className="text-[10px] text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/50 font-semibold">
                    OTC
                  </span>
                )}
              </span>
            </div>

            <button
              onClick={() => setActiveAlert(null)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-black/20 text-xs transition-colors"
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          {/* Asset & Direction Details */}
          <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/10">
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-wide text-white">
                {activeAlert.symbol}
              </span>
              <span className="text-[10px] text-gray-300 font-mono">
                {activeAlert.interval} Timeframe • {new Date(activeAlert.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-lg font-black text-sm tracking-wider uppercase flex items-center gap-1 shadow-md ${
                  isCall
                    ? 'bg-emerald-500 text-black shadow-emerald-500/40'
                    : 'bg-red-500 text-white shadow-red-500/40'
                }`}
              >
                <span>{isCall ? '▲ CALL' : '▼ PUT'}</span>
              </div>
            </div>
          </div>

          {/* Top Reason */}
          {activeAlert.reasons && activeAlert.reasons.length > 0 && (
            <p className="text-xs text-gray-200 line-clamp-2 italic bg-black/20 p-2 rounded-lg border border-white/5">
              "{activeAlert.reasons[0]}"
            </p>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-300">
              <span className="text-amber-400 animate-pulse">🔊</span>
              <span>Sound Played</span>
            </div>

            {activeAlert.symbol !== selectedSymbol ? (
              <button
                onClick={handleSwitchSymbol}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>⚡ View {activeAlert.symbol}</span>
              </button>
            ) : (
              <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
                Currently Viewing
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SoundAlertControls: React.FC = () => {
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const setSoundEnabled = useAppStore((s) => s.setSoundEnabled);
  const setActiveAlert = useAppStore((s) => s.setActiveAlert);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setSoundEnabled(next);
    if (next) {
      soundService.playTestAlert();
    }
  };

  const handleTestSound = () => {
    soundService.ensureContext();
    soundService.playTestAlert();
    // Also trigger desktop notification request if needed
    if (notificationService.isSupported() && !notificationService.isPermissionGranted()) {
      notificationService.requestPermission();
    }
  };

  const handleSimulateAlert = () => {
    soundService.playCallAlert();
    notificationService.sendNotification(
      '🚨 78% CALL ALERT: EUR/USD',
      'High Confidence Signal (78%) detected on 5min timeframe.'
    );
    setActiveAlert({
      id: 'sim-' + Date.now(),
      symbol: 'EUR/USD',
      direction: 'CALL',
      confidence: 78,
      interval: '5min',
      timestamp: new Date().toISOString(),
      reasons: ['Strong Bullish EMA alignment (EMA9 > EMA21 > EMA50) with price above support.'],
    });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Sound Toggle Pill */}
      <button
        onClick={toggleSound}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
          soundEnabled
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/40 shadow-sm'
            : 'bg-gray-800/80 border-gray-700 text-gray-400 hover:bg-gray-700'
        }`}
        title="Toggle audio chime alert for high confidence signals (>=75%)"
      >
        <span>{soundEnabled ? '🔊' : '🔇'}</span>
        <span className="font-mono text-[11px]">
          {soundEnabled ? 'Sound: ON (≥75%)' : 'Sound: Muted'}
        </span>
      </button>

      {/* Test Sound Button */}
      <button
        onClick={handleTestSound}
        className="px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors flex items-center gap-1"
        title="Test alert chime volume & unlock browser audio"
      >
        <span>🔔</span>
        <span className="hidden sm:inline">Test Sound</span>
      </button>

      {/* Quick Test Demo Alert */}
      <button
        onClick={handleSimulateAlert}
        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-900/40 hover:bg-purple-800/50 text-purple-300 border border-purple-600/40 transition-colors"
        title="Simulate a 75%+ alert with chime and notification"
      >
        <span>⚡ Test Alert</span>
      </button>
    </div>
  );
};
