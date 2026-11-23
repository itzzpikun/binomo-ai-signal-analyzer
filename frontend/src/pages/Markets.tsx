import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BINOMO_SCREENSHOT_ASSETS } from '../types';
import { useAppStore } from '../store/appStore';
import { AssetIcon } from '../components/market/AssetIcon';

const Markets: React.FC = () => {
  const navigate = useNavigate();
  const { selectedSymbol, setSelectedSymbol } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<'All' | 'Crypto' | 'Forex' | 'Commodities'>('All');
  const [search, setSearch] = useState('');

  const filtered = BINOMO_SCREENSHOT_ASSETS.filter((a) => {
    const matchesCat = activeCategory === 'All' || a.category === activeCategory;
    const matchesSearch =
      !search.trim() ||
      a.symbol.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    navigate('/');
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-gray-900 to-gray-950 p-4 sm:p-5 rounded-2xl border border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded bg-yellow-500 text-black font-extrabold flex items-center justify-center text-xs">
              B
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              Binomo OTC Markets ({BINOMO_SCREENSHOT_ASSETS.length})
            </h1>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm">
            Live 24/7 Over-The-Counter assets with real-time continuous candlestick streaming & auto signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search asset..."
            className="bg-gray-800 text-white placeholder-gray-500 text-xs rounded-xl px-3 py-2 border border-gray-700 outline-none focus:border-yellow-500 w-full sm:w-48"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {(['All', 'Crypto', 'Forex', 'Commodities'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeCategory === cat
                ? 'bg-yellow-500 text-black shadow-md shadow-yellow-500/20'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {cat} {cat === 'All' ? `(${BINOMO_SCREENSHOT_ASSETS.length})` : ''}
          </button>
        ))}
      </div>

      {/* Assets Table matching Screenshot format */}
      <div className="bg-[#181a24] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-12 px-4 py-3 text-xs font-bold text-gray-400 border-b border-gray-800 bg-[#12141c]">
          <div className="col-span-5 sm:col-span-6">Asset</div>
          <div className="col-span-3 sm:col-span-2 text-right">Profit ⓘ</div>
          <div className="col-span-2 sm:col-span-2 text-right">For VIP</div>
          <div className="col-span-2 sm:col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-gray-800/60">
          {filtered.map((asset) => {
            const isSelected = asset.symbol === selectedSymbol;
            return (
              <div
                key={asset.symbol}
                onClick={() => handleSelect(asset.symbol)}
                className={`grid grid-cols-12 items-center px-4 py-3.5 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#292d3b] text-white'
                    : 'hover:bg-[#1e222e] text-gray-300'
                }`}
              >
                {/* Asset Name + Icon */}
                <div className="col-span-5 sm:col-span-6 flex items-center gap-3 min-w-0">
                  <AssetIcon symbol={asset.symbol} className="w-8 h-8 flex-shrink-0" />
                  <div className="truncate">
                    <p className="font-bold text-sm text-white">{asset.symbol}</p>
                    <p className="text-[11px] text-gray-500 truncate">{asset.category} • 24/7 Live</p>
                  </div>
                </div>

                {/* Profit */}
                <div className="col-span-3 sm:col-span-2 text-right font-mono font-bold text-sm text-[#00b15d]">
                  {asset.profit || '80%'}
                </div>

                {/* For VIP */}
                <div className="col-span-2 sm:col-span-2 text-right font-mono font-bold text-sm text-[#00e676]">
                  {asset.vipProfit || '82%'}
                </div>

                {/* Action button */}
                <div className="col-span-2 sm:col-span-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(asset.symbol);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-yellow-500 text-black shadow-sm'
                        : 'bg-gray-800 text-gray-300 hover:bg-yellow-500 hover:text-black'
                    }`}
                  >
                    {isSelected ? 'Active ✓' : 'Analyze ↗'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Markets;
