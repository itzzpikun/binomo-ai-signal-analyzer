import React from 'react';
import { useAppStore } from '../../store/appStore';

const PriceTicker: React.FC = () => {
  const currentPrice = useAppStore((s) => s.currentPrice);
  const selectedSymbol = useAppStore((s) => s.selectedSymbol);
  const dataAvailable = useAppStore((s) => s.dataAvailable);
  const isSimulated = useAppStore((s) => s.isSimulated);

  const decimals = selectedSymbol.includes('JPY') ? 3
    : selectedSymbol.includes('BTC') ? 2
    : selectedSymbol.includes('ETH') ? 2
    : selectedSymbol.includes('XAU') ? 2
    : selectedSymbol.includes('US30') || selectedSymbol.includes('NAS') || selectedSymbol.includes('SPX') ? 2
    : 5;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <p className="text-gray-500 text-xs uppercase tracking-widest">Live Price</p>
        {isSimulated && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
            SIMULATED
          </span>
        )}
      </div>
      {currentPrice !== null && dataAvailable ? (
        <p className="text-3xl font-black font-mono text-gray-100">
          {currentPrice.toFixed(decimals)}
        </p>
      ) : (
        <p className="text-3xl font-black font-mono text-gray-600">---</p>
      )}
      <p className="text-gray-600 text-xs mt-1">{selectedSymbol}</p>
    </div>
  );
};

export default PriceTicker;
