import React from 'react';
import { useAppStore } from '../../store/appStore';
import StatusBadge from '../common/StatusBadge';
import BinomoLoginModal from '../common/BinomoLoginModal';

const Header: React.FC = () => {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const currentPrice = useAppStore((s) => s.currentPrice);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const isBinomoLoggedIn = useAppStore((s) => s.isBinomoLoggedIn);
  const binomoAccountType = useAppStore((s) => s.binomoAccountType);
  const binomoBalance = useAppStore((s) => s.binomoBalance);
  const binomoCurrency = useAppStore((s) => s.binomoCurrency);
  const setShowLoginModal = useAppStore((s) => s.setShowLoginModal);

  return (
    <>
      <BinomoLoginModal />
      <header className="bg-[#12151e]/95 border-b border-gray-800/80 px-2.5 sm:px-5 py-2 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-40 backdrop-blur-md">
        {/* Brand logo & platform title */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            title="Binomo Account Settings & Login"
          >
            <div className="w-8 h-8 rounded-lg bg-yellow-500 text-black font-black flex items-center justify-center text-base shadow-md shadow-yellow-500/20">
              B
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-white font-extrabold text-sm tracking-wider flex items-center gap-1.5">
                <span>BINOMO LIVE</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-yellow-500/20 text-yellow-400 font-mono">
                  OTC AI
                </span>
              </div>
              <div className="text-[10px] text-gray-400 font-medium">
                Live Candles & Auto Signals
              </div>
            </div>
          </button>
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

        {/* Right side: Binomo Login / Account Status & Web Link */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Binomo Account Balance Button */}
          <button
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-yellow-500/40 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Click to switch Demo/Real or edit Binomo credentials"
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-yellow-400 font-bold uppercase leading-none">
                {binomoAccountType}
              </span>
              <span className="text-white font-mono font-extrabold text-[11px] sm:text-xs leading-tight">
                {binomoCurrency} {binomoBalance.toLocaleString()}
              </span>
            </div>
          </button>

          {/* Quick Login button if disconnected */}
          {!isBinomoLoggedIn && (
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs shadow-sm transition-all"
            >
              Log In
            </button>
          )}

          {/* Official Binomo Portal Link */}
          <a
            href="https://binomo.com/trading"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs flex items-center gap-1 shadow-md shadow-yellow-500/20 transition-all hover:scale-105 active:scale-95"
            title="Open official Binomo Web Trading in new tab"
          >
            <span>Binomo Web</span>
            <span className="text-sm">↗</span>
          </a>
        </div>
      </header>
    </>
  );
};

export default Header;
