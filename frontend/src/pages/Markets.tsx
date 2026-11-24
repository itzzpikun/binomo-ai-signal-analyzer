import React, { useState } from 'react';
import { ASSET_CATEGORIES, AssetCategory } from '../types';
import { useAppStore } from '../store/appStore';
import clsx from 'clsx';

const categoryColors: Record<AssetCategory, string> = {
  Forex:       'text-blue-400 bg-blue-900/30 border-blue-800',
  Crypto:      'text-purple-400 bg-purple-900/30 border-purple-800',
  Commodities: 'text-amber-400 bg-amber-900/30 border-amber-800',
  Indices:     'text-cyan-400 bg-cyan-900/30 border-cyan-800',
  'Binomo OTC': 'text-amber-400 bg-amber-900/30 border-amber-800',
};

const Markets: React.FC = () => {
  const { selectedSymbol, setSelectedSymbol } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<AssetCategory | 'All'>('All');

  const categories = Object.keys(ASSET_CATEGORIES) as AssetCategory[];
  const allAssets = categories.flatMap(cat =>
    ASSET_CATEGORIES[cat].map(a => ({ ...a }))
  );
  const filtered = activeCategory === 'All'
    ? allAssets
    : ASSET_CATEGORIES[activeCategory as AssetCategory];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Markets</h1>
      <p className="text-gray-400 text-sm mb-6">
        All supported assets for 5-minute technical analysis. Data sourced from Twelve Data API.
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['All', ...categories] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
              activeCategory === cat
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            )}
          >
            {cat}
            {cat !== 'All' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({ASSET_CATEGORIES[cat as AssetCategory].length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(asset => (
          <div
            key={asset.symbol}
            onClick={() => setSelectedSymbol(asset.symbol)}
            className={clsx(
              'bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500/50',
              selectedSymbol === asset.symbol
                ? 'border-blue-500 bg-blue-900/10'
                : 'border-gray-800'
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-bold text-white text-base">{asset.symbol}</p>
                <p className="text-gray-400 text-xs mt-0.5">{asset.name}</p>
              </div>
              <span className={clsx(
                'text-xs px-2 py-0.5 rounded-full border font-medium',
                categoryColors[asset.category]
              )}>
                {asset.category}
              </span>
            </div>
            {asset.pip && (
              <p className="text-gray-600 text-xs">Pip: {asset.pip}</p>
            )}
            {asset.isOtc && (
              <p className="text-amber-400 text-[11px] font-semibold mt-1">
                ⚠️ Simulated (no real data available)
              </p>
            )}
            {selectedSymbol === asset.symbol && (
              <div className="mt-2 text-xs text-blue-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                Active on Dashboard
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-gray-600 text-xs text-center">
        ⚠️ OTC prices on trading platforms may differ from live market data shown here.
        Always verify prices before trading.
      </p>
    </div>
  );
};

export default Markets;
