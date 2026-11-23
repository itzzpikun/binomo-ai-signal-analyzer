import React from 'react';
import { useAppStore } from '../../store/appStore';
import StatusBadge from '../common/StatusBadge';

const Header: React.FC = () => {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const currentPrice = useAppStore((s) => s.currentPrice);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);

  const isOtc = selectedSymbol.toUpperCase().includes('(OTC)') || selectedSymbol.toUpperCase().includes('CRYPTO IDX');

  return (
    <header className="bg-[#12151e]/95 border-b border-gray-800/80 px-2.5 sm:px-5 py-2 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 backdrop-blur-md">
      {/* Brand logo & platform title */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500 text-black font-black flex items-center justify-center text-base shadow-md shadow-yellow-500/20">
            B
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-white font-extrabold text-sm tracking-wider flex items-center gap-1.5">
              <span>BINOMO QUANT</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-400 font-mono">
                {isOtc ? 'OTC FEED' : 'REAL MARKET'}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 font-medium">
              100-Point Signal Engine &amp; AI Arbiter
            </div>
          </div>
        </div>
      </div>

      {/* Selected asset symbol & live price */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800">
          <span className="text-xs font-bold text-gray-200">{selectedSymbol}</span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {currentPrice !== null ? currentPrice.toFixed(selectedSymbol.includes('USD') && !selectedSymbol.includes('BTC') ? 5 : 2) : '---'}
          </span>
        </div>
        <div className="hidden md:block">
          <StatusBadge status={connectionStatus} />
        </div>
      </div>

      {/* Right side: Feed Status & Official External Trade Link */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Data Validation Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-900 border border-emerald-500/30 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-gray-300 font-semibold text-[11px]">Validated Feed</span>
        </div>

        {/* Official Binomo Portal Link (Manual Execution) */}
        <a
          href="https://binomo.com/trading"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 sm:px-4 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs flex items-center gap-1 shadow-md shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95"
          title="Open official Binomo Web Trading in new tab"
        >
          <span>Trade on Binomo</span>
          <span className="text-sm">↗</span>
        </a>
      </div>
    </header>
  );
};

export default Header;
