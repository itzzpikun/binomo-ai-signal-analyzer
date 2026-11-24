import React from 'react';
import { useAppStore } from '../../store/appStore';
import StatusBadge from '../common/StatusBadge';

const Header: React.FC = () => {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const currentPrice = useAppStore((s) => s.currentPrice);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);

  return (
    <header className="bg-gray-900/95 border-b border-gray-800 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 backdrop-blur-md">
      {/* Brand logo for mobile (hidden on md where sidebar is visible) */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-white font-bold text-xs sm:text-sm tracking-wide">Binomo AI</span>
      </div>

      {/* Asset symbol & live price */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800/80 border border-gray-700/60">
          <span className="text-xs font-bold text-gray-200">{selectedSymbol}</span>
          <span className="text-[11px] font-mono font-semibold text-emerald-400">
            {currentPrice !== null ? currentPrice.toFixed(5) : '---'}
          </span>
        </div>
        <div className="hidden sm:block">
          <StatusBadge status={connectionStatus} />
        </div>
      </div>

      {/* Right Actions: Binomo Button */}
      <div className="flex items-center gap-2">
        <div className="sm:hidden">
          <StatusBadge status={connectionStatus} />
        </div>
        <a
          href="https://binomo.com/trading"
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs flex items-center gap-1 shadow-md shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95"
          title="Open Binomo Trading Platform in new tab"
        >
          <span>Binomo</span>
          <span className="text-sm">↗</span>
        </a>
      </div>
    </header>
  );
};

export default Header;
