// ============================================================
// src/services/marketData.service.ts — Genuine Market Data Service
// Real Non-OTC symbols use Twelve Data & Coinbase/Binance (source: "real")
// OTC symbols use generateLiveBinomoCandles (source: "simulated", status: "no real data available")
// ============================================================
import axios, { AxiosError } from 'axios';
import ENV from '../config/env';
import cacheService from './cache.service';
import type { OHLCCandle, AssetCategory } from '../types';

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

const SUPPORTED_ASSETS: AssetCategory[] = [
  {
    category: 'Forex',
    assets: [
      { symbol: 'EUR/USD', name: 'Euro / US Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/USD', name: 'British Pound / US Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/CAD', name: 'Australian Dollar / Canadian Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/CHF', name: 'Australian Dollar / Swiss Franc', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/NZD', name: 'Australian Dollar / New Zealand Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/JPY', name: 'Australian Dollar / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/SGD', name: 'Australian Dollar / Singapore Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/NOK', name: 'Australian Dollar / Norwegian Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/SEK', name: 'Australian Dollar / Swedish Krona', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/DKK', name: 'Australian Dollar / Danish Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/HUF', name: 'Australian Dollar / Hungarian Forint', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'AUD/ZAR', name: 'Australian Dollar / South African Rand', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CAD/JPY', name: 'Canadian Dollar / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CAD/SEK', name: 'Canadian Dollar / Swedish Krona', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CAD/NOK', name: 'Canadian Dollar / Norwegian Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CAD/MXN', name: 'Canadian Dollar / Mexican Peso', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CAD/DKK', name: 'Canadian Dollar / Danish Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CAD/SGD', name: 'Canadian Dollar / Singapore Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CHF/JPY', name: 'Swiss Franc / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CHF/SGD', name: 'Swiss Franc / Singapore Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CHF/NOK', name: 'Swiss Franc / Norwegian Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CHF/DKK', name: 'Swiss Franc / Danish Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'CHF/HUF', name: 'Swiss Franc / Hungarian Forint', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/HUF', name: 'Euro / Hungarian Forint', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/MXN', name: 'Euro / Mexican Peso', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/ILS', name: 'Euro / Israeli Shekel', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/ZAR', name: 'Euro / South African Rand', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/NOK', name: 'Euro / Norwegian Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/NZD', name: 'Euro / New Zealand Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/SEK', name: 'Euro / Swedish Krona', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/SGD', name: 'Euro / Singapore Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'EUR/PLN', name: 'Euro / Polish Zloty', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/CAD', name: 'British Pound / Canadian Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/NZD', name: 'British Pound / New Zealand Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/HKD', name: 'British Pound / Hong Kong Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/HUF', name: 'British Pound / Hungarian Forint', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/DKK', name: 'British Pound / Danish Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/NOK', name: 'British Pound / Norwegian Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/SGD', name: 'British Pound / Singapore Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/PLN', name: 'British Pound / Polish Zloty', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/MXN', name: 'British Pound / Mexican Peso', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'GBP/CZK', name: 'British Pound / Czech Koruna', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NOK/SEK', name: 'Norwegian Krone / Swedish Krona', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NOK/JPY', name: 'Norwegian Krone / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/CAD', name: 'New Zealand Dollar / Canadian Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/CHF', name: 'New Zealand Dollar / Swiss Franc', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/JPY', name: 'New Zealand Dollar / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/SGD', name: 'New Zealand Dollar / Singapore Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/NOK', name: 'New Zealand Dollar / Norwegian Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/SEK', name: 'New Zealand Dollar / Swedish Krona', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/DKK', name: 'New Zealand Dollar / Danish Krone', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'NZD/HUF', name: 'New Zealand Dollar / Hungarian Forint', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'SEK/JPY', name: 'Swedish Krona / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'SGD/JPY', name: 'Singapore Dollar / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'SGD/HKD', name: 'Singapore Dollar / Hong Kong Dollar', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/SEK', name: 'US Dollar / Swedish Krona', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/ZAR', name: 'US Dollar / South African Rand', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/PLN', name: 'US Dollar / Polish Zloty', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/CZK', name: 'US Dollar / Czech Koruna', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/HUF', name: 'US Dollar / Hungarian Forint', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/ILS', name: 'US Dollar / Israeli Shekel', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'USD/MXN', name: 'US Dollar / Mexican Peso', type: 'forex', isOtc: false, source: 'real' },
      { symbol: 'ZAR/JPY', name: 'South African Rand / Japanese Yen', type: 'forex', isOtc: false, source: 'real' },
    ],
  },
  {
    category: 'Crypto',
    assets: [
      { symbol: 'Crypto IDX', name: 'Crypto IDX (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Bitcoin (OTC)', name: 'Bitcoin (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Ethereum (OTC)', name: 'Ethereum (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Solana (OTC)', name: 'Solana (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Aave (OTC)', name: 'Aave (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Uniswap (OTC)', name: 'Uniswap (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Chainlink (OTC)', name: 'Chainlink (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Pancake Swap (OTC)', name: 'Pancake Swap (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Kusama (OTC)', name: 'Kusama (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Bitcoin Cash (OTC)', name: 'Bitcoin Cash (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
    ],
  },
  {
    category: 'Commodities',
    assets: [
      { symbol: 'Gold', name: 'Gold / US Dollar', type: 'commodity', isOtc: false, source: 'real' },
    ],
  },
  {
    category: 'Binomo OTC',
    assets: [
      { symbol: 'Crypto IDX', name: 'Crypto IDX (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Bitcoin (OTC)', name: 'Bitcoin (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Ethereum (OTC)', name: 'Ethereum (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Solana (OTC)', name: 'Solana (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Aave (OTC)', name: 'Aave (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Uniswap (OTC)', name: 'Uniswap (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Chainlink (OTC)', name: 'Chainlink (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Pancake Swap (OTC)', name: 'Pancake Swap (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Kusama (OTC)', name: 'Kusama (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'Bitcoin Cash (OTC)', name: 'Bitcoin Cash (OTC)', type: 'crypto', isOtc: true, source: 'simulated' },
      { symbol: 'EUR/GBP (OTC)', name: 'Euro / British Pound (OTC)', type: 'forex', isOtc: true, source: 'simulated' },
    ],
  },
];

const VALID_SYMBOLS = SUPPORTED_ASSETS.flatMap((cat) => cat.assets.map((a) => a.symbol));
const VALID_INTERVALS = ['1min', '5min', '15min'];

const OTC_SPECS: Record<string, { basePrice: number; decimals: number; volatility: number }> = {
  'CRYPTO_IDX': { basePrice: 6245.50, decimals: 2, volatility: 0.0035 },
  'CRYPTO IDX': { basePrice: 6245.50, decimals: 2, volatility: 0.0035 },
  'BITCOIN (OTC)': { basePrice: 96500.00, decimals: 2, volatility: 0.0050 },
  'BTC/USD (OTC)': { basePrice: 96500.00, decimals: 2, volatility: 0.0050 },
  'ETHEREUM (OTC)': { basePrice: 3250.00, decimals: 2, volatility: 0.0050 },
  'ETH/USD (OTC)': { basePrice: 3250.00, decimals: 2, volatility: 0.0050 },
  'SOLANA (OTC)': { basePrice: 165.00, decimals: 2, volatility: 0.0060 },
  'SOL/USD (OTC)': { basePrice: 165.00, decimals: 2, volatility: 0.0060 },
  'AAVE (OTC)': { basePrice: 185.00, decimals: 2, volatility: 0.0060 },
  'UNISWAP (OTC)': { basePrice: 9.80, decimals: 2, volatility: 0.0060 },
  'CHAINLINK (OTC)': { basePrice: 14.50, decimals: 2, volatility: 0.0060 },
  'PANCAKE SWAP (OTC)': { basePrice: 2.45, decimals: 2, volatility: 0.0060 },
  'KUSAMA (OTC)': { basePrice: 22.50, decimals: 2, volatility: 0.0060 },
  'BITCOIN CASH (OTC)': { basePrice: 450.00, decimals: 2, volatility: 0.0050 },
  'EUR/GBP (OTC)': { basePrice: 0.8550, decimals: 5, volatility: 0.0025 },
  'EUR/USD (OTC)': { basePrice: 1.0850, decimals: 5, volatility: 0.0025 },
  'GBP/USD (OTC)': { basePrice: 1.2650, decimals: 5, volatility: 0.0028 },
  'USD/JPY (OTC)': { basePrice: 154.50, decimals: 3, volatility: 0.0025 },
  'AUD/CAD (OTC)': { basePrice: 0.9140, decimals: 5, volatility: 0.0025 },
};

function hasApiKey(customKey?: string): boolean {
  const key = customKey || ENV.TWELVE_DATA_API_KEY;
  return Boolean(key && key !== 'your_key_here');
}

function pseudoHash(n: number): number {
  const x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}

export function isOtcSymbol(symbol: string): boolean {
  const sym = symbol.toUpperCase();
  return sym.includes('(OTC)') || sym.includes('OTC') || sym === 'CRYPTO_IDX' || sym === 'CRYPTO IDX';
}

/**
 * Generates continuous simulated Binomo candles.
 * Explicitly marks EVERY candle with source: "simulated".
 */
export function generateLiveBinomoCandles(
  symbol: string,
  interval = '1min',
  outputsize = 100
): OHLCCandle[] {
  const sym = symbol.toUpperCase();
  const spec = OTC_SPECS[sym] || { basePrice: 100.0, decimals: 2, volatility: 0.0025 };
  const nowMs = Date.now();
  const intervalSeconds = interval === '1min' ? 60 : interval === '15min' ? 900 : 300;
  const currentIntervalSlot = Math.floor(nowMs / 1000 / intervalSeconds) * intervalSeconds;

  const candles: OHLCCandle[] = [];
  const assetSeed = (sym.charCodeAt(0) * 31 + sym.charCodeAt(sym.length - 1)) % 1000;
  const dayIndex = Math.floor(nowMs / (86400 * 1000));
  const macroWave = Math.sin((dayIndex + assetSeed) * 0.1) * 0.02;
  let currentPrice = spec.basePrice * (1 + macroWave);

  const slots: number[] = [];
  for (let i = outputsize - 1; i >= 0; i--) {
    slots.push(currentIntervalSlot - i * intervalSeconds);
  }

  for (let idx = 0; idx < slots.length; idx++) {
    const slotTimeSec = slots[idx];
    const slotSeed = slotTimeSec / intervalSeconds + assetSeed * 1000;

    const wave1 = Math.sin(slotSeed * 0.12) * spec.volatility * 1.5;
    const wave2 = Math.cos(slotSeed * 0.035) * spec.volatility * 2.2;
    const noise = (pseudoHash(slotSeed) - 0.495) * spec.volatility * 2.0;
    const returnPct = wave1 + wave2 + noise;

    const open = currentPrice;
    const close = open * (1 + returnPct);

    const wickUp = Math.abs(pseudoHash(slotSeed * 1.3)) * spec.volatility * 1.4;
    const wickDown = Math.abs(pseudoHash(slotSeed * 1.7)) * spec.volatility * 1.4;

    const high = Math.max(open, close) * (1 + wickUp);
    const low = Math.min(open, close) * (1 - wickDown);
    const vol = Math.floor(100 + pseudoHash(slotSeed * 2.1) * 1500);

    candles.push({
      timestamp: new Date(slotTimeSec * 1000).toISOString(),
      open: parseFloat(open.toFixed(spec.decimals)),
      high: parseFloat(high.toFixed(spec.decimals)),
      low: parseFloat(low.toFixed(spec.decimals)),
      close: parseFloat(close.toFixed(spec.decimals)),
      volume: vol,
      source: 'simulated',
    });
    currentPrice = close;
  }

  return candles;
}

function formatPriceValue(val: number): number {
  if (val >= 50) {
    return parseFloat(val.toFixed(2));
  }
  return parseFloat(val.toFixed(5));
}

async function fetchCryptoCandles(symbol: string, interval: string, outputsize: number): Promise<OHLCCandle[] | null> {
  const coinbaseMap: Record<string, string> = {
    'BTC/USD': 'BTC-USD',
    'ETH/USD': 'ETH-USD',
  };
  const binanceMap: Record<string, string> = {
    'BTC/USD': 'BTCUSDT',
    'ETH/USD': 'ETHUSDT',
    'BNB/USD': 'BNBUSDT',
    'SOL/USD': 'SOLUSDT',
  };

  // 1. Try Coinbase Exchange API (highly reliable, no geo-blocking on US cloud hosts)
  const cbProduct = coinbaseMap[symbol.toUpperCase()];
  if (cbProduct) {
    const granularityMap: Record<string, number> = { '1min': 60, '5min': 300, '15min': 900 };
    const granularity = granularityMap[interval] || 300;
    try {
      const res = await axios.get(`https://api.exchange.coinbase.com/products/${cbProduct}/candles`, {
        params: { granularity },
        headers: { 'User-Agent': 'BinomoAIAnalyzer/2.0' },
        timeout: 8000,
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        // Coinbase returns [time, low, high, open, close, volume], sorted newest first
        const candles: OHLCCandle[] = res.data.slice(0, outputsize).reverse().map((k: any) => ({
          timestamp: new Date(k[0] * 1000).toISOString(),
          open: formatPriceValue(k[3]),
          high: formatPriceValue(k[2]),
          low: formatPriceValue(k[1]),
          close: formatPriceValue(k[4]),
          volume: parseFloat(k[5] || '0'),
          source: 'real',
        }));
        return candles;
      }
    } catch {
      // Fallback to Binance
    }
  }

  // 2. Try Binance / Binance US
  const binanceSymbol = binanceMap[symbol.toUpperCase()];
  if (binanceSymbol) {
    const intervalMap: Record<string, string> = { '1min': '1m', '5min': '5m', '15min': '15m' };
    const bInterval = intervalMap[interval] || '5m';
    for (const host of ['https://api.binance.com', 'https://api.binance.us']) {
      try {
        const res = await axios.get(`${host}/api/v3/klines`, {
          params: { symbol: binanceSymbol, interval: bInterval, limit: Math.min(outputsize, 300) },
          timeout: 6000,
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data.map((k: any) => ({
            timestamp: new Date(k[0]).toISOString(),
            open: formatPriceValue(parseFloat(k[1])),
            high: formatPriceValue(parseFloat(k[2])),
            low: formatPriceValue(parseFloat(k[3])),
            close: formatPriceValue(parseFloat(k[4])),
            volume: parseFloat(k[5] || '0'),
            source: 'real',
          }));
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

async function fetchCryptoPrice(symbol: string): Promise<number | null> {
  const coinbaseMap: Record<string, string> = {
    'BTC/USD': 'BTC-USD',
    'ETH/USD': 'ETH-USD',
  };
  const binanceMap: Record<string, string> = {
    'BTC/USD': 'BTCUSDT',
    'ETH/USD': 'ETHUSDT',
    'BNB/USD': 'BNBUSDT',
    'SOL/USD': 'SOLUSDT',
  };

  // 1. Try Coinbase ticker
  const cbProduct = coinbaseMap[symbol.toUpperCase()];
  if (cbProduct) {
    try {
      const res = await axios.get(`https://api.exchange.coinbase.com/products/${cbProduct}/ticker`, {
        headers: { 'User-Agent': 'BinomoAIAnalyzer/2.0' },
        timeout: 6000,
      });
      if (res.data?.price) {
        return formatPriceValue(parseFloat(res.data.price));
      }
    } catch {
      // Fallback
    }
  }

  // 2. Try Binance / Binance US
  const binanceSymbol = binanceMap[symbol.toUpperCase()];
  if (binanceSymbol) {
    for (const host of ['https://api.binance.com', 'https://api.binance.us']) {
      try {
        const res = await axios.get(`${host}/api/v3/ticker/price`, {
          params: { symbol: binanceSymbol },
          timeout: 5000,
        });
        if (res.data?.price) {
          return formatPriceValue(parseFloat(res.data.price));
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function dataUnavailable(message: string): never {
  const err = new Error(message) as Error & { statusCode: number; status: string };
  err.statusCode = 503;
  err.status = 'DATA_UNAVAILABLE';
  throw err;
}

export const marketDataService = {
  isOtc(symbol: string): boolean {
    return isOtcSymbol(symbol);
  },

  getSupportedAssets(): AssetCategory[] {
    return SUPPORTED_ASSETS;
  },

  getAssetsList(): Array<{ symbol: string; name: string; category: string; isOtc: boolean; source: 'real' | 'simulated' }> {
    return SUPPORTED_ASSETS.flatMap((cat) =>
      cat.assets.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        category: cat.category,
        isOtc: Boolean(a.isOtc),
        source: (a.source || (a.isOtc ? 'simulated' : 'real')) as 'real' | 'simulated',
      }))
    );
  },

  validateSymbol(symbol: string): void {
    if (!VALID_SYMBOLS.includes(symbol.toUpperCase()) && !isOtcSymbol(symbol)) {
      throw Object.assign(new Error(`Unsupported symbol: ${symbol}`), {
        statusCode: 400,
        status: 'VALIDATION_ERROR',
      });
    }
  },

  validateInterval(interval: string): void {
    if (!VALID_INTERVALS.includes(interval)) {
      throw Object.assign(
        new Error(`Unsupported interval: ${interval}. Valid: 1min, 5min, 15min`),
        { statusCode: 400, status: 'VALIDATION_ERROR' }
      );
    }
  },

  async getCandles(
    symbol: string,
    interval = '5min',
    outputsize = 100,
    customApiKey?: string
  ): Promise<OHLCCandle[]> {
    const sym = symbol.toUpperCase();
    this.validateSymbol(sym);
    this.validateInterval(interval);

    // OTC symbols ALWAYS use simulated candles
    if (isOtcSymbol(sym)) {
      return generateLiveBinomoCandles(sym, interval, outputsize);
    }

    // Real crypto: Coinbase / Binance
    if (['BTC/USD', 'ETH/USD', 'BNB/USD', 'SOL/USD'].includes(sym)) {
      const cryptoCandles = await fetchCryptoCandles(sym, interval, outputsize);
      if (cryptoCandles && cryptoCandles.length > 0) {
        return cryptoCandles;
      }
    }

    // Real Forex, Commodities, Indices via Twelve Data
    const activeKey = customApiKey || ENV.TWELVE_DATA_API_KEY;

    if (!hasApiKey(activeKey)) {
      dataUnavailable(`Twelve Data API key not configured for real asset ${sym}. Set your API key in Settings.`);
    }

    const cacheKey = `candles:${sym}:${interval}:${outputsize}:${activeKey?.slice(-4) || 'default'}`;
    const cached = cacheService.get<OHLCCandle[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE}/time_series`, {
        params: {
          symbol: sym,
          interval,
          outputsize,
          format: 'JSON',
          apikey: activeKey,
        },
        timeout: 20000,
      });

      const body = response.data as {
        status?: string;
        code?: number;
        message?: string;
        values?: Array<{
          datetime: string;
          open: string;
          high: string;
          low: string;
          close: string;
          volume: string;
        }>;
      };

      if (body.status === 'error' || body.code) {
        dataUnavailable(body.message ?? 'Twelve Data API returned an error');
      }

      if (!body.values || body.values.length === 0) {
        dataUnavailable('No candle data returned from Twelve Data API');
      }

      // Twelve Data returns newest first — reverse to chronological order
      const candles: OHLCCandle[] = body.values.reverse().map((v) => ({
        timestamp: v.datetime,
        open: formatPriceValue(parseFloat(v.open)),
        high: formatPriceValue(parseFloat(v.high)),
        low: formatPriceValue(parseFloat(v.low)),
        close: formatPriceValue(parseFloat(v.close)),
        volume: parseFloat(v.volume ?? '0'),
        source: 'real',
      }));

      // Cache for interval duration
      const cacheTTL = interval === '1min' ? 60 : interval === '5min' ? 300 : 900;
      cacheService.set(cacheKey, candles, cacheTTL);

      return candles;
    } catch (err) {
      if ((err as Error & { status?: string }).status === 'DATA_UNAVAILABLE') throw err;
      const axiosErr = err as AxiosError;
      if (axiosErr.response) {
        dataUnavailable(
          `Twelve Data API error ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`
        );
      }
      dataUnavailable(`Failed to reach Twelve Data API: ${(err as Error).message}`);
    }
  },

  async getCurrentPrice(symbol: string, customApiKey?: string): Promise<number> {
    const sym = symbol.toUpperCase();
    this.validateSymbol(sym);

    // OTC symbols: price from simulated candle close
    if (isOtcSymbol(sym)) {
      const simCandles = generateLiveBinomoCandles(sym, '1min', 2);
      return simCandles[simCandles.length - 1].close;
    }

    // Real crypto
    if (['BTC/USD', 'ETH/USD', 'BNB/USD', 'SOL/USD'].includes(sym)) {
      const cryptoPrice = await fetchCryptoPrice(sym);
      if (cryptoPrice !== null) return cryptoPrice;
    }

    const activeKey = customApiKey || ENV.TWELVE_DATA_API_KEY;

    if (!hasApiKey(activeKey)) {
      dataUnavailable(`Twelve Data API key not configured for ${sym}.`);
    }

    const cacheKey = `price:${sym}`;
    const cached = cacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    // Check recent cached candles
    for (const tf of ['5min', '1min', '15min']) {
      for (const size of [100, 50, 30]) {
        const cachedCandles = cacheService.get<OHLCCandle[]>(`candles:${sym}:${tf}:${size}:${activeKey?.slice(-4) || 'default'}`);
        if (cachedCandles && cachedCandles.length > 0) {
          const latestPrice = cachedCandles[cachedCandles.length - 1].close;
          cacheService.set(cacheKey, latestPrice, 15);
          return latestPrice;
        }
      }
    }

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE}/price`, {
        params: { symbol: sym, apikey: activeKey },
        timeout: 15000,
      });

      const body = response.data as { price?: string; code?: number; message?: string };

      if (body.code || !body.price) {
        dataUnavailable(body.message ?? 'Could not retrieve current price');
      }

      const price = formatPriceValue(parseFloat(body.price!));
      cacheService.set(cacheKey, price, 30);
      return price;
    } catch (err) {
      if ((err as Error & { status?: string }).status === 'DATA_UNAVAILABLE') throw err;
      dataUnavailable(`Failed to fetch price: ${(err as Error).message}`);
    }
  },

  async getApiStatus(): Promise<{ available: boolean; hasKey: boolean; message: string }> {
    if (!hasApiKey()) {
      return { available: false, hasKey: false, message: 'API key not configured' };
    }

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE}/api_usage`, {
        params: { apikey: ENV.TWELVE_DATA_API_KEY },
        timeout: 15000,
      });
      const body = response.data as { current_usage?: number; code?: number; message?: string };
      if (body.code) return { available: false, hasKey: true, message: body.message || 'Invalid API key' };
      return { available: true, hasKey: true, message: 'Twelve Data API connected' };
    } catch (err) {
      return { available: false, hasKey: true, message: `Cannot reach Twelve Data API: ${(err as Error).message}` };
    }
  },

  async getDetailedStatus(): Promise<{
    symbols: Record<string, { source: 'real' | 'simulated'; provider: string; status: string }>;
    sources: { real: string[]; simulated: string[] };
    dataProvider: {
      twelveData: { available: boolean; hasKey: boolean; message: string };
      cryptoFeeds: { status: string; providers: string[] };
      otcFeeds: { status: string; simulated: boolean };
    };
  }> {
    const apiStatus = await this.getApiStatus();
    const allAssets = this.getAssetsList();

    const symbolsMap: Record<string, { source: 'real' | 'simulated'; provider: string; status: string }> = {};
    const realSymbols: string[] = [];
    const simulatedSymbols: string[] = [];

    for (const asset of allAssets) {
      if (asset.isOtc) {
        symbolsMap[asset.symbol] = {
          source: 'simulated',
          provider: 'Simulated OTC',
          status: 'no real data available',
        };
        simulatedSymbols.push(asset.symbol);
      } else if (asset.category === 'Crypto') {
        symbolsMap[asset.symbol] = {
          source: 'real',
          provider: 'Coinbase / Binance',
          status: 'available',
        };
        realSymbols.push(asset.symbol);
      } else {
        symbolsMap[asset.symbol] = {
          source: 'real',
          provider: 'Twelve Data',
          status: apiStatus.available ? 'available' : 'api_key_required',
        };
        realSymbols.push(asset.symbol);
      }
    }

    return {
      symbols: symbolsMap,
      sources: {
        real: realSymbols,
        simulated: simulatedSymbols,
      },
      dataProvider: {
        twelveData: apiStatus,
        cryptoFeeds: { status: 'connected', providers: ['Coinbase', 'Binance'] },
        otcFeeds: { status: 'no real data available', simulated: true },
      },
    };
  },
};

export default marketDataService;
