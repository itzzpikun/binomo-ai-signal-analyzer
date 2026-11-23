import React from 'react';

interface AssetIconProps {
  symbol: string;
  className?: string;
}

export const AssetIcon: React.FC<AssetIconProps> = ({ symbol, className = 'w-7 h-7' }) => {
  const sym = symbol.toUpperCase();

  if (sym.includes('CRYPTO IDX') || sym.includes('CRYPTO_IDX')) {
    return (
      <div className={`${className} rounded-full bg-gray-800 border border-yellow-500/40 flex items-center justify-center text-xs font-bold shadow-sm`}>
        <span className="text-[10px] text-yellow-400">⚡IDX</span>
      </div>
    );
  }

  if (sym.includes('BITCOIN CASH')) {
    return (
      <div className={`${className} rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
        ₿
      </div>
    );
  }

  if (sym.includes('BITCOIN') || sym.includes('BTC')) {
    return (
      <div className={`${className} rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
        ₿
      </div>
    );
  }

  if (sym.includes('ETHEREUM') || sym.includes('ETH')) {
    return (
      <div className={`${className} rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
        Ξ
      </div>
    );
  }

  if (sym.includes('SOLANA') || sym.includes('SOL')) {
    return (
      <div className={`${className} rounded-full bg-gradient-to-tr from-purple-600 to-teal-400 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
        ◎
      </div>
    );
  }

  if (sym.includes('GOLD') || sym.includes('XAU')) {
    return (
      <div className={`${className} rounded-full bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 flex items-center justify-center text-black font-extrabold text-[11px] shadow-sm`}>
        Au
      </div>
    );
  }

  if (sym.includes('BARCELONA') || sym.includes('BAR')) {
    return (
      <div className={`${className} rounded-full bg-gradient-to-r from-blue-700 to-red-600 flex items-center justify-center text-yellow-300 font-extrabold text-[10px] shadow-sm`}>
        FCB
      </div>
    );
  }

  if (sym.includes('CARDANO') || sym.includes('ADA')) {
    return (
      <div className={`${className} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
        ₳
      </div>
    );
  }

  if (sym.includes('KUSAMA') || sym.includes('KSM')) {
    return (
      <div className={`${className} rounded-full bg-gray-950 border border-gray-700 flex items-center justify-center text-gray-200 font-bold text-xs shadow-sm`}>
        🦅
      </div>
    );
  }

  if (sym.includes('AAVE')) {
    return (
      <div className={`${className} rounded-full bg-purple-700 flex items-center justify-center text-cyan-300 font-bold text-xs shadow-sm`}>
        👻
      </div>
    );
  }

  if (sym.includes('CHAINLINK') || sym.includes('LINK')) {
    return (
      <div className={`${className} rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
        ⬡
      </div>
    );
  }

  if (sym.includes('UNISWAP') || sym.includes('UNI')) {
    return (
      <div className={`${className} rounded-full bg-pink-600 flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
        🦄
      </div>
    );
  }

  if (sym.includes('PANCAKE') || sym.includes('CAKE')) {
    return (
      <div className={`${className} rounded-full bg-amber-400 flex items-center justify-center text-gray-900 font-bold text-xs shadow-sm`}>
        🥞
      </div>
    );
  }

  // Forex Pairs Flags
  if (sym.includes('AUD/USD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇦🇺🇺🇸</div>;
  if (sym.includes('NZD/USD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇳🇿🇺🇸</div>;
  if (sym.includes('GBP/NZD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇬🇧🇳🇿</div>;
  if (sym.includes('EUR/CAD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇪🇺🇨🇦</div>;
  if (sym.includes('GBP/JPY')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇬🇧🇯🇵</div>;
  if (sym.includes('GBP/USD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇬🇧🇺🇸</div>;
  if (sym.includes('EUR/GBP')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇪🇺🇬🇧</div>;
  if (sym.includes('AUD/CAD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇦🇺🇨🇦</div>;
  if (sym.includes('EUR/USD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇪🇺🇺🇸</div>;
  if (sym.includes('USD/JPY')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇺🇸🇯🇵</div>;
  if (sym.includes('USD/CAD')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇺🇸🇨🇦</div>;
  if (sym.includes('GBP/CHF')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇬🇧🇨🇭</div>;
  if (sym.includes('CHF/JPY')) return <div className={`${className} rounded-full bg-blue-900 flex items-center justify-center text-[10px]`}>🇨🇭🇯🇵</div>;

  return (
    <div className={`${className} rounded-full bg-gray-800 flex items-center justify-center text-gray-300 font-bold text-xs`}>
      {sym.slice(0, 2)}
    </div>
  );
};
