import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { BINOMO_SCREENSHOT_ASSETS } from '../../types';

interface BinomoTradePanelProps {
  direction?: 'CALL' | 'PUT' | 'WAIT';
  confidence?: number;
}

export const BinomoTradePanel: React.FC<BinomoTradePanelProps> = ({ direction, confidence }) => {
  const {
    selectedSymbol,
    binomoCurrency,
    binomoBalance,
    setBinomoBalance,
    setShowLoginModal,
  } = useAppStore();

  const [tradeAmount, setTradeAmount] = useState<number>(() => (binomoCurrency === '₹' ? 1000 : 10));
  const [activeTrade, setActiveTrade] = useState<{
    dir: 'CALL' | 'PUT';
    amount: number;
    symbol: string;
    timeLeft: number;
  } | null>(null);

  const assetSpec =
    BINOMO_SCREENSHOT_ASSETS.find((a) => a.symbol === selectedSymbol) || BINOMO_SCREENSHOT_ASSETS[0];

  const profitPct = parseInt(assetSpec.profit?.replace('%', '') || '80', 10);
  const potentialProfit = ((tradeAmount * profitPct) / 100);
  const totalReturn = tradeAmount + potentialProfit;

  const handleExecute = (dir: 'CALL' | 'PUT') => {
    if (binomoBalance < tradeAmount) {
      alert('Insufficient demo balance. Please reset or login to your account.');
      setShowLoginModal(true);
      return;
    }

    setBinomoBalance(binomoBalance - tradeAmount);
    setActiveTrade({
      dir,
      amount: tradeAmount,
      symbol: selectedSymbol,
      timeLeft: 60,
    });

    // Start 60s trade countdown
    let remaining = 60;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        // Win with high probability aligned with AI signal
        const isWin = direction === dir || Math.random() < 0.85;
        if (isWin) {
          setBinomoBalance(binomoBalance - tradeAmount + totalReturn);
          alert(`🎉 WIN! Trade on ${selectedSymbol} ended in profit! +${binomoCurrency} ${totalReturn.toFixed(2)} credited!`);
        } else {
          alert(`Trade on ${selectedSymbol} closed.`);
        }
        setActiveTrade(null);
      } else {
        setActiveTrade((prev) => (prev ? { ...prev, timeLeft: remaining } : null));
      }
    }, 1000);
  };

  return (
    <div className="bg-[#141722] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col gap-3">
      {/* Top bar with payout % */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-yellow-500 text-black font-black text-[10px] flex items-center justify-center">
            B
          </span>
          <span className="font-extrabold text-xs text-white uppercase tracking-wider">
            Binomo Order Execution
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400">Payout:</span>
          <span className="font-mono font-bold text-xs text-[#00e676] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            +{profitPct}% VIP
          </span>
        </div>
      </div>

      {/* Active Trade Notification */}
      {activeTrade && (
        <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/40 rounded-xl flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded font-black text-black ${activeTrade.dir === 'CALL' ? 'bg-[#00b15d]' : 'bg-[#ff3355]'}`}>
              {activeTrade.dir}
            </span>
            <span className="text-gray-200 font-semibold">
              {binomoCurrency} {activeTrade.amount} on {activeTrade.symbol}
            </span>
          </div>
          <span className="font-mono font-bold text-yellow-400">
            ⏱️ {activeTrade.timeLeft}s left
          </span>
        </div>
      )}

      {/* Investment Amount Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
          <span>Investment Amount:</span>
          <span className="text-gray-300">
            Return: <strong className="text-emerald-400 font-mono">+{binomoCurrency} {totalReturn.toLocaleString()}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={tradeAmount}
            onChange={(e) => setTradeAmount(Math.max(10, parseInt(e.target.value) || 0))}
            className="flex-1 bg-gray-900 border border-gray-700 focus:border-yellow-500 text-white font-mono font-bold text-sm rounded-xl px-3 py-2 outline-none"
          />
          <div className="flex items-center gap-1">
            {[1000, 2500, 5000].map((amt) => {
              const val = binomoCurrency === '₹' ? amt : amt / 100;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTradeAmount(val)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    tradeAmount === val
                      ? 'bg-yellow-500 text-black border-yellow-500'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  +{binomoCurrency}{val}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CALL / PUT Action Buttons styled with Binomo Aesthetics */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {/* CALL BUTTON (GREEN) */}
        <button
          type="button"
          onClick={() => handleExecute('CALL')}
          className={`relative group flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-gradient-to-t from-[#008f4c] to-[#00b15d] hover:to-[#00c968] text-white font-black shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-[0.98] border ${
            direction === 'CALL'
              ? 'border-yellow-400 ring-2 ring-yellow-400/50'
              : 'border-emerald-600/50'
          }`}
        >
          {direction === 'CALL' && (
            <span className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-yellow-400 text-black font-extrabold text-[9px] uppercase tracking-wide shadow-sm animate-bounce">
              ⭐ AI SIGNAL ({confidence || 85}%)
            </span>
          )}
          <span className="text-base sm:text-lg flex items-center gap-1">
            <span>CALL</span>
            <span className="text-xl">▲</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-100 font-semibold opacity-90">
            Higher (+{profitPct}%)
          </span>
        </button>

        {/* PUT BUTTON (RED) */}
        <button
          type="button"
          onClick={() => handleExecute('PUT')}
          className={`relative group flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-gradient-to-t from-[#cc1e38] to-[#ff3355] hover:to-[#ff4d6d] text-white font-black shadow-lg shadow-red-950/40 transition-all hover:scale-[1.02] active:scale-[0.98] border ${
            direction === 'PUT'
              ? 'border-yellow-400 ring-2 ring-yellow-400/50'
              : 'border-red-600/50'
          }`}
        >
          {direction === 'PUT' && (
            <span className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-yellow-400 text-black font-extrabold text-[9px] uppercase tracking-wide shadow-sm animate-bounce">
              ⭐ AI SIGNAL ({confidence || 85}%)
            </span>
          )}
          <span className="text-base sm:text-lg flex items-center gap-1">
            <span>PUT</span>
            <span className="text-xl">▼</span>
          </span>
          <span className="text-[10px] font-mono text-red-100 font-semibold opacity-90">
            Lower (+{profitPct}%)
          </span>
        </button>
      </div>

      {/* Account Info Pill */}
      <div className="flex items-center justify-between text-[11px] pt-1 text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Binomo Live Execution (Instant)</span>
        </span>
        <button
          onClick={() => setShowLoginModal(true)}
          className="text-yellow-400 font-semibold hover:underline"
        >
          Switch Account
        </button>
      </div>
    </div>
  );
};
