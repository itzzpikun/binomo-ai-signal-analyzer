import React, { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  interval: string;
}

const SYMBOL_MAP: Record<string, string> = {
  'CRYPTO_IDX': 'BINANCE:BTCUSDT',
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT',
  'BNB/USD': 'BINANCE:BNBUSDT',
  'EUR/USD': 'FX:EURUSD',
  'GBP/USD': 'FX:GBPUSD',
  'USD/JPY': 'FX:USDJPY',
  'USD/CHF': 'FX:USDCHF',
  'AUD/USD': 'FX:AUDUSD',
  'XAU/USD': 'OANDA:XAUUSD',
  'US30': 'FOREXCOM:DJI',
  'NAS100': 'NASDAQ:NDX',
};

const INTERVAL_MAP: Record<string, string> = {
  '1min': '1',
  '5min': '5',
  '15min': '15',
};

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol, interval }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const tvSymbol = SYMBOL_MAP[symbol.toUpperCase()] || 'FX:EURUSD';
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

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol, tvInterval]);

  return (
    <div className="w-full h-full min-h-[380px] sm:min-h-[440px] rounded-xl overflow-hidden bg-gray-950 border border-gray-800">
      <div ref={containerRef} className="tradingview-widget-container w-full h-full min-h-[380px] sm:min-h-[440px]" />
    </div>
  );
};

export default memo(TradingViewWidget);
