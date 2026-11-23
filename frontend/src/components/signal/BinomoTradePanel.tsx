import React from 'react';
import { useAppStore } from '../../store/appStore';
import { BINOMO_SCREENSHOT_ASSETS } from '../../types';

interface BinomoTradePanelProps {
  direction?: 'CALL' | 'PUT' | 'WAIT';
  confidence?: number;
}

export const BinomoTradePanel: React.FC<BinomoTradePanelProps> = ({ direction = 'WAIT', confidence = 0 }) => {
  const { selectedSymbol, selectedInterval, currentSignal } = useAppStore();

  const assetSpec =
    BINOMO_SCREENSHOT_ASSETS.find((a) => a.symbol === selectedSymbol) || BINOMO_SCREENSHOT_ASSETS[0];

  const profitPct = parseInt(assetSpec.profit?.replace('%', '') || '80', 10);
  const isCall = direction === 'CALL';
  const isPut = direction === 'PUT';
  const isWait = direction === 'WAIT';

  const regime = currentSignal?.market_regime || 'TRENDING';
  const dataQuality = (currentSignal as any)?.data_quality;

  return (
    <div className="bg-[#141722] border border-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col gap-3">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-yellow-500 text-black font-black text-[10px] flex items-center justify-center">
            B
          </div>
          <span className="font-extrabold text-xs text-white uppercase tracking-wider">
            Trade Execution Protocol
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Binomo Payout:</span>
          <span className="font-mono font-bold text-xs text-[#00e676] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            +{profitPct}%
          </span>
        </div>
      </div>

      {/* Execution Parameters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase block font-semibold">Entry Window</span>
          <span className="font-mono font-bold text-amber-300 text-xs">0 - 15 Seconds</span>
          <span className="text-[9px] text-gray-500 block">At candle open</span>
        </div>
        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase block font-semibold">Suggested Expiry</span>
          <span className="font-mono font-bold text-gray-200 text-xs">{selectedInterval} (Fixed)</span>
          <span className="text-[9px] text-gray-500 block">Single candle duration</span>
        </div>
        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase block font-semibold">Market Regime</span>
          <span className={`font-mono font-bold text-xs ${regime === 'TRENDING' ? 'text-emerald-400' : regime === 'VOLATILE' ? 'text-red-400' : 'text-amber-400'}`}>
            {regime}
          </span>
          <span className="text-[9px] text-gray-500 block">{regime === 'TRENDING' ? 'High Momentum' : 'Chop / Caution'}</span>
        </div>
        <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase block font-semibold">Data Feed</span>
          <span className="font-mono font-bold text-emerald-400 text-xs">
            {dataQuality?.isOtc ? 'Binomo OTC' : 'Standard Feed'}
          </span>
          <span className="text-[9px] text-gray-500 block">Real-time Verified</span>
        </div>
      </div>

      {/* Action Recommendation Banner */}
      <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
        isCall
          ? 'bg-emerald-950/40 border-emerald-500/50'
          : isPut
          ? 'bg-red-950/40 border-red-500/50'
          : 'bg-amber-950/30 border-amber-500/40'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">
            {isCall ? '🟢' : isPut ? '🔴' : '⚠️'}
          </span>
          <div>
            <span className={`font-extrabold text-xs block ${
              isCall ? 'text-emerald-400' : isPut ? 'text-red-400' : 'text-amber-400'
            }`}>
              {isCall
                ? `RECOMMENDED ACTION: BUY HIGHER (CALL) on ${selectedSymbol}`
                : isPut
                ? `RECOMMENDED ACTION: BUY LOWER (PUT) on ${selectedSymbol}`
                : 'RECOMMENDED ACTION: WAIT / AVOID ENTRY'}
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {isWait
                ? (currentSignal as any)?.false_signal_filter?.reason || 'Quantitative setup score below threshold. Capital protection active.'
                : `100-Point Setup Score: ${confidence}/100. Open trade in Binomo within first 15s of new candle.`}
            </p>
          </div>
        </div>

        {/* Trade on Binomo Direct Action */}
        <a
          href="https://binomo.com/trading"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs flex items-center gap-1 shadow-md shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
        >
          <span>Open Binomo</span>
          <span className="text-sm">↗</span>
        </a>
      </div>

      {/* Safety Notice: Automatic Real-Money Trading is Disabled */}
      <p className="text-[10px] text-gray-500 italic text-center">
        🔒 Automatic real-money execution is strictly disabled. Verify setup on chart and execute trades manually on official Binomo platform.
      </p>
    </div>
  );
};
export default BinomoTradePanel;
