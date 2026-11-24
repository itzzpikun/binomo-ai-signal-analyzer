import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { api } from '../../services/api';
import type { RiskSettings, RiskState, TradeRiskAdvice } from '../../types';

const RiskWarning: React.FC = () => {
  const [riskData, setRiskData] = useState<{
    settings: RiskSettings;
    state: RiskState;
    advice: TradeRiskAdvice;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [bankrollInput, setBankrollInput] = useState('1000');
  const [stakePctInput, setStakePctInput] = useState('0.5');
  const [lossLimitPctInput, setLossLimitPctInput] = useState('2.0');
  const [isSaving, setIsSaving] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await api.getRiskStatus();
        if (isMounted && res && res.settings && res.state) {
          setRiskData(res);
          setBankrollInput(res.settings.bankroll.toString());
          setStakePctInput(res.settings.maxStakePercentage.toString());
          setLossLimitPctInput(res.settings.dailyLossLimitPercentage.toString());
        }
      } catch {
        // Fallback default
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const bankroll = parseFloat(bankrollInput) || 1000;
      const maxStakePercentage = parseFloat(stakePctInput) || 0.5;
      const dailyLossLimitPercentage = parseFloat(lossLimitPctInput) || 2.0;

      const updated = await api.updateRiskSettings({
        bankroll,
        maxStakePercentage,
        dailyLossLimitPercentage,
      });

      if (updated && updated.settings) {
        setRiskData((prev) =>
          prev
            ? {
                ...prev,
                settings: updated.settings,
                advice: {
                  ...prev.advice,
                  maxAllowedStake: (updated.settings.bankroll * updated.settings.maxStakePercentage) / 100,
                  recommendedStake: (updated.settings.bankroll * updated.settings.maxStakePercentage) / 100,
                },
              }
            : null
        );
      }
      setIsEditing(false);
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const settings = riskData?.settings || {
    bankroll: 1000,
    maxStakePercentage: 0.5,
    dailyLossLimitPercentage: 2.0,
    maxConsecutiveLosses: 3,
    cooldownMinutes: 30,
  };

  const state = riskData?.state || {
    currentDailyLoss: 0,
    consecutiveLosses: 0,
    isDailyLimitBreached: false,
    isCooldownActive: false,
    cooldownUntil: null,
    tradesTodayCount: 0,
    dailyWins: 0,
    dailyLosses: 0,
    lastUpdated: new Date().toISOString(),
  };

  const advice = riskData?.advice || {
    isTradePermitted: true,
    status: 'PERMITTED',
    recommendedStake: 5.0,
    maxAllowedStake: 5.0,
    reason: 'Trade permitted within risk boundaries (0.5% max stake: $5.00).',
    cooldownRemainingSeconds: 0,
    antiMartingaleWarning: 'STRICT ANTI-MARTINGALE POLICY: Never double your stake after a loss.',
  };

  const maxDailyLossAmount = (settings.bankroll * settings.dailyLossLimitPercentage) / 100;
  const recommendedStakeAmount = (settings.bankroll * settings.maxStakePercentage) / 100;

  return (
    <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-3 sm:p-4 flex flex-col gap-3 shadow-lg">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-base">🛡️</span>
          <div>
            <h4 className="text-gray-200 font-bold text-xs sm:text-sm flex items-center gap-1.5">
              <span>Capital Preservation &amp; Loss Protection</span>
              <span
                className={clsx(
                  'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                  advice.isTradePermitted
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-500/40 text-red-300 animate-pulse'
                )}
              >
                {advice.isTradePermitted ? '● ACTIVE & PROTECTED' : '🛑 TRADING HALTED'}
              </span>
            </h4>
            <p className="text-gray-400 text-[11px]">
              Institutional 0.5% max stake cap • 2% daily loss limit • Anti-Martingale enforcement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded bg-amber-950/40 border border-amber-500/30 transition-colors"
          >
            {isEditing ? 'Cancel' : '⚙️ Configure Bankroll'}
          </button>
          <button
            onClick={() => setShowDisclaimer(!showDisclaimer)}
            className="text-[11px] text-gray-400 hover:text-gray-200 px-2 py-1 rounded bg-gray-800 border border-gray-700"
            title="Toggle risk warning disclaimer"
          >
            ⚠️ Notice
          </button>
        </div>
      </div>

      {/* Editing Form */}
      {isEditing && (
        <form onSubmit={handleSaveSettings} className="bg-gray-950 p-3 rounded-lg border border-gray-800 flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-gray-400 block mb-1">Trading Bankroll ($):</label>
            <input
              type="number"
              min="10"
              step="10"
              value={bankrollInput}
              onChange={(e) => setBankrollInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1 text-xs text-white font-mono"
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="text-[10px] text-gray-400 block mb-1">Max Stake (%):</label>
            <input
              type="number"
              min="0.1"
              max="5"
              step="0.1"
              value={stakePctInput}
              onChange={(e) => setStakePctInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1 text-xs text-white font-mono"
            />
          </div>
          <div className="w-full sm:w-36">
            <label className="text-[10px] text-gray-400 block mb-1">Daily Loss Limit (%):</label>
            <input
              type="number"
              min="0.5"
              max="20"
              step="0.5"
              value={lossLimitPctInput}
              onChange={(e) => setLossLimitPctInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2.5 py-1 text-xs text-white font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-bold rounded transition-colors"
          >
            {isSaving ? 'Saving...' : 'Apply'}
          </button>
        </form>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div className="bg-gray-950/70 border border-gray-800 p-2.5 rounded-lg">
          <span className="text-gray-500 text-[10px] block">Trading Bankroll</span>
          <span className="font-bold text-gray-200 text-sm">${settings.bankroll.toFixed(2)}</span>
        </div>

        <div className="bg-gray-950/70 border border-gray-800 p-2.5 rounded-lg">
          <span className="text-gray-500 text-[10px] block">Max Stake (0.5% Cap)</span>
          <span className="font-bold text-emerald-400 text-sm">
            ${recommendedStakeAmount.toFixed(2)} <span className="text-[10px] text-gray-400">/ trade</span>
          </span>
        </div>

        <div className="bg-gray-950/70 border border-gray-800 p-2.5 rounded-lg">
          <span className="text-gray-500 text-[10px] block">Daily Loss Limit (2.0%)</span>
          <span className={clsx('font-bold text-sm', state.isDailyLimitBreached ? 'text-red-400' : 'text-amber-400')}>
            ${state.currentDailyLoss.toFixed(2)} / ${maxDailyLossAmount.toFixed(2)}
          </span>
        </div>

        <div className="bg-gray-950/70 border border-gray-800 p-2.5 rounded-lg">
          <span className="text-gray-500 text-[10px] block">Consecutive Losses</span>
          <span className={clsx('font-bold text-sm', state.consecutiveLosses >= 2 ? 'text-red-400' : 'text-gray-200')}>
            {state.consecutiveLosses} / {settings.maxConsecutiveLosses} Max
          </span>
        </div>
      </div>

      {/* Halt or Active Notice */}
      {!advice.isTradePermitted && (
        <div className="bg-red-950/60 border border-red-500/70 rounded-lg p-2.5 flex items-center gap-2">
          <span className="text-red-400 text-base">🛑</span>
          <div className="text-xs">
            <span className="font-bold text-red-300 uppercase tracking-wide">
              {advice.status === 'DAILY_LIMIT_HALT' ? 'DAILY LOSS LIMIT BREACHED' : 'LOSS COOLDOWN ACTIVE'}
            </span>
            <p className="text-red-200/90 text-[11px] mt-0.5">{advice.reason}</p>
          </div>
        </div>
      )}

      {/* Anti-Martingale Rules Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-800/60 gap-1">
        <span className="flex items-center gap-1 text-yellow-400/90">
          <span>🚫</span>
          <span><b>Anti-Martingale Rule:</b> Never double stake after a loss. Keep stakes flat at 0.5% max.</span>
        </span>
        <span className="text-gray-500 text-[10px]">Manual trade execution only • Analysis only</span>
      </div>

      {/* Expandable full regulatory disclaimer */}
      {showDisclaimer && (
        <div className="bg-yellow-950/30 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-200/80 leading-relaxed mt-1">
          <p className="font-bold text-yellow-300 mb-1">REGULATORY &amp; ACCURACY NOTICE</p>
          <p>
            This application is an educational quantitative analysis tool. In accordance with strict risk management
            principles, signals do not guarantee profit, and accuracy claims above realistic statistical thresholds
            are prohibited. All binary option trading carries capital risk. Never trade with money you cannot afford to lose.
          </p>
        </div>
      )}
    </div>
  );
};

export default RiskWarning;
