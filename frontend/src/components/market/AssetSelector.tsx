import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { BINOMO_SCREENSHOT_ASSETS } from '../../types';
import type { Asset } from '../../types';
import { AssetIcon } from './AssetIcon';

const AssetSelector: React.FC = () => {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<'All' | 'Crypto' | 'Forex' | 'Commodities'>('All');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeAsset =
    BINOMO_SCREENSHOT_ASSETS.find((a) => a.symbol === selectedSymbol) || BINOMO_SCREENSHOT_ASSETS[0];

  const displayedAssets = BINOMO_SCREENSHOT_ASSETS.filter((a) => {
    const matchesSearch =
      !search.trim() ||
      a.symbol.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === 'All' || a.category === filterCat;
    return matchesSearch && matchesCat;
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleSelect = (asset: Asset) => {
    setSelectedSymbol(asset.symbol);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Active Asset Button styled like Binomo header pill */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-700/80 rounded-xl px-3 py-2 transition-all shadow-md group active:scale-95"
      >
        <AssetIcon symbol={activeAsset.symbol} className="w-6 h-6" />
        <div className="text-left flex flex-col">
          <span className="text-gray-100 font-bold text-xs sm:text-sm tracking-wide group-hover:text-yellow-400 transition-colors">
            {activeAsset.symbol}
          </span>
          <span className="text-[10px] text-emerald-400 font-semibold font-mono leading-none">
            {activeAsset.profit || '80%'} payout
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Binomo Style Dropdown Modal Matching Screenshot */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 bg-[#1a1d26] border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-fade-in">
          {/* Header & Search */}
          <div className="p-3 bg-[#13151c] border-b border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5 uppercase tracking-wider">
                <span>🟡</span>
                <span>Binomo Market Assets ({BINOMO_SCREENSHOT_ASSETS.length})</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">24/7 Live Feed</span>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search OTC asset (e.g. Crypto IDX, Bitcoin)..."
              className="w-full bg-[#222634] text-gray-100 placeholder-gray-500 text-xs rounded-xl px-3 py-2 outline-none border border-gray-700 focus:border-yellow-500 transition-colors"
            />

            {/* Quick category filter tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar text-[11px]">
              {(['All', 'Crypto', 'Forex', 'Commodities'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-2.5 py-0.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                    filterCat === cat
                      ? 'bg-yellow-500 text-black'
                      : 'bg-gray-800/80 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Table Header matching screenshot */}
          <div className="grid grid-cols-12 px-3.5 py-2 text-[11px] font-bold text-gray-400 border-b border-gray-800 bg-[#141720]">
            <div className="col-span-6">Asset</div>
            <div className="col-span-3 text-right">Profit ⓘ</div>
            <div className="col-span-3 text-right text-gray-400 underline decoration-dotted">For VIP</div>
          </div>

          {/* Asset Rows matching screenshot */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/40">
            {displayedAssets.length > 0 ? (
              displayedAssets.map((asset) => {
                const isSelected = asset.symbol === selectedSymbol;
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => handleSelect(asset)}
                    className={`w-full grid grid-cols-12 items-center px-3.5 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#2a2e39] text-white'
                        : 'hover:bg-[#202430] text-gray-300'
                    }`}
                  >
                    {/* Asset Name + Icon */}
                    <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                      <AssetIcon symbol={asset.symbol} className="w-6 h-6 flex-shrink-0" />
                      <span className="font-semibold text-xs truncate">
                        {asset.symbol}
                      </span>
                    </div>

                    {/* Profit */}
                    <div className="col-span-3 text-right font-mono font-bold text-xs text-[#00b15d]">
                      {asset.profit || '80%'}
                    </div>

                    {/* For VIP */}
                    <div className="col-span-3 text-right font-mono font-bold text-xs text-[#00e676]">
                      {asset.vipProfit || '82%'}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-gray-500">
                No matching Binomo assets found
              </div>
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="p-2.5 bg-[#13151c] border-t border-gray-800 text-[10px] text-gray-500 text-center flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live OTC Synchronized
            </span>
            <span>Click any asset to analyze</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetSelector;
