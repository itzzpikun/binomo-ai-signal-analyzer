import React, { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  interval: string;
}

const SPECIAL_TV_SYMBOLS: Record<string, string> = {
  'CRYPTO_IDX': 'BINANCE:BTCUSDT',
  'CRYPTO IDX': 'BINANCE:BTCUSDT',
  'BITCOIN (OTC)': 'BINANCE:BTCUSDT',
  'ETHEREUM (OTC)': 'BINANCE:ETHUSDT',
  'SOLANA (OTC)': 'BINANCE:SOLUSDT',
  'AAVE (OTC)': 'BINANCE:AAVEUSDT',
  'UNISWAP (OTC)': 'BINANCE:UNIUSDT',
  'CHAINLINK (OTC)': 'BINANCE:LINKUSDT',
  'PANCAKE SWAP (OTC)': 'BINANCE:CAKEUSDT',
  'KUSAMA (OTC)': 'BINANCE:KSMUSDT',
  'BITCOIN CASH (OTC)': 'BINANCE:BCHUSDT',
  'BTC/USD (OTC)': 'BINANCE:BTCUSDT',
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT',
  'SOL/USD': 'BINANCE:SOLUSDT',
  'BNB/USD': 'BINANCE:BNBUSDT',
  'GOLD': 'OANDA:XAUUSD',
  'XAU/USD': 'OANDA:XAUUSD',
  'US30': 'FOREXCOM:DJI',
  'NAS100': 'NASDAQ:NDX',
  'SPX500': 'FOREXCOM:SPX500',
};

const INTERVAL_MAP: Record<string, string> = {
  '1min': '1',
  '5min': '5',
  '15min': '15',
};

export function resolveTradingViewSymbol(rawSymbol: string): string {
  const upper = (rawSymbol || '').toUpperCase().trim();
  if (SPECIAL_TV_SYMBOLS[upper]) {
    return SPECIAL_TV_SYMBOLS[upper];
  }

  // Strip (OTC) suffix if present
  const clean = upper.replace(/\s*\(OTC\)/i, '').trim();
  if (SPECIAL_TV_SYMBOLS[clean]) {
    return SPECIAL_TV_SYMBOLS[clean];
  }

  // Standard forex pair format BASE/QUOTE e.g. EUR/USD -> FX:EURUSD
  if (clean.includes('/')) {
    const [base, quote] = clean.split('/');
    if (base && quote) {
      return `FX:${base.trim()}${quote.trim()}`;
    }
  }

  return 'FX:EURUSD';
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol, interval }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const tvSymbol = resolveTradingViewSymbol(symbol);
  const tvInterval = INTERVAL_MAP[interval] || '5';

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget script/container
    containerRef.current.innerHTML = '';

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1', // Candlestick style
      locale: 'en',
      enable_publishing: false,
      backgroundColor: '#0a0f1d',
      gridColor: '#1e293b',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });
    script.onerror = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '<p class="text-red-500">Failed to load TradingView chart.</p>';
      }
    };

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol, tvInterval]);

  return (
    <div className="w-full h-full min-h-[400px] sm:min-h-[460px] rounded-xl overflow-hidden bg-gray-950 border border-gray-800">
      <div ref={containerRef} className="tradingview-widget-container w-full h-full min-h-[400px] sm:min-h-[460px]" />
    </div>
  );
};

export default memo(TradingViewWidget);
