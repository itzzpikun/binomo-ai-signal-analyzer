import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { ASSET_CATEGORIES } from '../../types';
import type { Asset, AssetCategory } from '../../types';
import clsx from 'clsx';

const ALL_ASSETS: Asset[] = Object.values(ASSET_CATEGORIES).flat();

const AssetSelector: React.FC = () => {
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useAppStore((s) => s.setSelectedSymbol);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? ALL_ASSETS.filter(
        (a) =>
          a.symbol.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase())
      )
    : null;

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
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (asset: Asset) => {
    setSelectedSymbol(asset.symbol);
    setIsOpen(false);
    setSearch('');
  };

  const categories: AssetCategory[] = ['Forex', 'Crypto', 'Commodities', 'Indices', 'Binomo OTC'];
  const categoryColors: Record<AssetCategory, string> = {
    Forex: 'text-blue-400',
    Crypto: 'text-orange-400',
    Commodities: 'text-yellow-400',
    Indices: 'text-purple-400',
    'Binomo OTC': 'text-amber-400',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-2 transition-colors"
      >
        <span className="text-gray-100 font-semibold text-sm">{selectedSymbol}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-800">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="w-full bg-gray-800 text-gray-100 placeholder-gray-500 text-sm rounded-lg px-3 py-2 outline-none border border-gray-700 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto">
            {filtered ? (
              filtered.length > 0 ? (
                <div className="p-2">
                  {filtered.map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => handleSelect(asset)}
                      className={clsx(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                        asset.symbol === selectedSymbol
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                      )}
                    >
                      <span className="font-medium flex items-center gap-1.5">
                        {asset.symbol}
                        {asset.isOtc && (
                          <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-700/50">
                            Simulated
                          </span>
                        )}
                      </span>
                      <span className={clsx('text-xs', categoryColors[asset.category])}>
                        {asset.category}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-6">No assets found</p>
              )
            ) : (
              categories.map((category) => (
                <div key={category} className="px-2 py-2">
                  <p className={clsx('text-xs font-semibold uppercase tracking-widest px-3 py-1', categoryColors[category])}>
                    {category}
                  </p>
                  {ASSET_CATEGORIES[category].map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => handleSelect(asset)}
                      className={clsx(
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                        asset.symbol === selectedSymbol
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                      )}
                    >
                      <span className="font-medium flex items-center gap-1.5">
                        {asset.symbol}
                        {asset.isOtc && (
                          <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-700/50">
                            Simulated
                          </span>
                        )}
                      </span>
                      <span className="text-gray-500 text-xs">{asset.name.split('/')[0] || asset.name}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetSelector;
