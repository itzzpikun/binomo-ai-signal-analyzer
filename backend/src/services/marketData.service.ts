// ============================================================
// src/services/marketData.service.ts — Twelve Data API client
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
      { symbol: 'EUR/USD', name: 'Euro / US Dollar', type: 'forex' },
      { symbol: 'GBP/USD', name: 'British Pound / US Dollar', type: 'forex' },
      { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', type: 'forex' },
      { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', type: 'forex' },
      { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', type: 'forex' },
    ],
  },
  {
    category: 'Crypto',
    assets: [
      { symbol: 'CRYPTO_IDX', name: 'Crypto IDX (Binomo 24/7)', type: 'crypto' },
      { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', type: 'crypto' },
      { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', type: 'crypto' },
      { symbol: 'BNB/USD', name: 'BNB / US Dollar', type: 'crypto' },
    ],
  },
  {
    category: 'Commodities',
    assets: [
      { symbol: 'XAU/USD', name: 'Gold / US Dollar', type: 'commodity' },
    ],
  },
  {
    category: 'Indices',
    assets: [
      { symbol: 'US30', name: 'Dow Jones Industrial Average', type: 'index' },
      { symbol: 'NAS100', name: 'Nasdaq 100', type: 'index' },
    ],
  },
];

const VALID_SYMBOLS = SUPPORTED_ASSETS.flatMap((cat) => cat.assets.map((a) => a.symbol));
const VALID_INTERVALS = ['1min', '5min', '15min'];

function hasApiKey(customKey?: string): boolean {
  const key = customKey || ENV.TWELVE_DATA_API_KEY;
  return Boolean(key && key !== 'your_key_here');
}

async function fetchCryptoCandles(symbol: string, interval: string, outputsize: number): Promise<OHLCCandle[] | null> {
  const isCryptoIdx = symbol.toUpperCase() === 'CRYPTO_IDX';
  const coinbaseMap: Record<string, string> = {
    'CRYPTO_IDX': 'BTC-USD',
    'BTC/USD': 'BTC-USD',
    'ETH/USD': 'ETH-USD',
  };
  const binanceMap: Record<string, string> = {
    'CRYPTO_IDX': 'BTCUSDT',
    'BTC/USD': 'BTCUSDT',
    'ETH/USD': 'ETHUSDT',
    'BNB/USD': 'BNBUSDT',
  };
  const scale = isCryptoIdx ? 0.065 : 1.0;

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
        const candles: OHLCCandle[] = res.data.slice(0, outputsize).map((k: any) => ({
          timestamp: new Date(k[0] * 1000).toISOString(),
          open: parseFloat((k[3] * scale).toFixed(2)),
          high: parseFloat((k[2] * scale).toFixed(2)),
          low: parseFloat((k[1] * scale).toFixed(2)),
          close: parseFloat((k[4] * scale).toFixed(2)),
          volume: parseFloat(k[5] || '0'),
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
            open: parseFloat((parseFloat(k[1]) * scale).toFixed(2)),
            high: parseFloat((parseFloat(k[2]) * scale).toFixed(2)),
            low: parseFloat((parseFloat(k[3]) * scale).toFixed(2)),
            close: parseFloat((parseFloat(k[4]) * scale).toFixed(2)),
            volume: parseFloat(k[5] || '0'),
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
  const isCryptoIdx = symbol.toUpperCase() === 'CRYPTO_IDX';
  const coinbaseMap: Record<string, string> = {
    'CRYPTO_IDX': 'BTC-USD',
    'BTC/USD': 'BTC-USD',
    'ETH/USD': 'ETH-USD',
  };
  const binanceMap: Record<string, string> = {
    'CRYPTO_IDX': 'BTCUSDT',
    'BTC/USD': 'BTCUSDT',
    'ETH/USD': 'ETHUSDT',
    'BNB/USD': 'BNBUSDT',
  };
  const scale = isCryptoIdx ? 0.065 : 1.0;

  // 1. Try Coinbase ticker
  const cbProduct = coinbaseMap[symbol.toUpperCase()];
  if (cbProduct) {
    try {
      const res = await axios.get(`https://api.exchange.coinbase.com/products/${cbProduct}/ticker`, {
        headers: { 'User-Agent': 'BinomoAIAnalyzer/2.0' },
        timeout: 6000,
      });
      if (res.data?.price) {
        return parseFloat((parseFloat(res.data.price) * scale).toFixed(2));
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
          return parseFloat((parseFloat(res.data.price) * scale).toFixed(2));
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
  getSupportedAssets(): AssetCategory[] {
    return SUPPORTED_ASSETS;
  },

  validateSymbol(symbol: string): void {
    if (!VALID_SYMBOLS.includes(symbol.toUpperCase())) {
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

    // Crypto IDX is a 24/7 composite asset — always try crypto feed first
    if (sym === 'CRYPTO_IDX' || sym.includes('/USD') && ['BTC/USD', 'ETH/USD', 'BNB/USD'].includes(sym)) {
      const cryptoCandles = await fetchCryptoCandles(sym, interval, outputsize);
      if (cryptoCandles && cryptoCandles.length > 0) {
        return cryptoCandles;
      }
    }

    const activeKey = customApiKey || ENV.TWELVE_DATA_API_KEY;

    if (!hasApiKey(activeKey)) {
      const cryptoFallback = await fetchCryptoCandles(sym, interval, outputsize);
      if (cryptoFallback && cryptoFallback.length > 0) {
        return cryptoFallback;
      }
      dataUnavailable('Market Data API key not configured. Set your Twelve Data API key in Settings.');
    }

    const cacheKey = `candles:${sym}:${interval}:${outputsize}:${activeKey?.slice(-4) || 'default'}`;
    const cached = cacheService.get<OHLCCandle[]>(cacheKey);
    if (cached) return cached;

    // For Twelve Data, map CRYPTO_IDX to BTC/USD
    const querySymbol = sym === 'CRYPTO_IDX' ? 'BTC/USD' : sym;
    const scale = sym === 'CRYPTO_IDX' ? 0.065 : 1.0;

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE}/time_series`, {
        params: {
          symbol: querySymbol,
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
        const cryptoFallback = await fetchCryptoCandles(sym, interval, outputsize);
        if (cryptoFallback && cryptoFallback.length > 0) {
          cacheService.set(cacheKey, cryptoFallback, 60);
          return cryptoFallback;
        }
        dataUnavailable(body.message ?? 'Twelve Data API returned an error');
      }

      if (!body.values || body.values.length === 0) {
        const cryptoFallback = await fetchCryptoCandles(sym, interval, outputsize);
        if (cryptoFallback && cryptoFallback.length > 0) {
          return cryptoFallback;
        }
        dataUnavailable('No candle data returned from Twelve Data API');
      }

      const candles: OHLCCandle[] = body.values.map((v) => ({
        timestamp: v.datetime,
        open: parseFloat((parseFloat(v.open) * scale).toFixed(2)),
        high: parseFloat((parseFloat(v.high) * scale).toFixed(2)),
        low: parseFloat((parseFloat(v.low) * scale).toFixed(2)),
        close: parseFloat((parseFloat(v.close) * scale).toFixed(2)),
        volume: parseFloat(v.volume ?? '0'),
      }));

      // Cache for interval duration
      const cacheTTL = interval === '1min' ? 60 : interval === '5min' ? 300 : 900;
      cacheService.set(cacheKey, candles, cacheTTL);

      return candles;
    } catch (err) {
      const cryptoFallback = await fetchCryptoCandles(sym, interval, outputsize);
      if (cryptoFallback && cryptoFallback.length > 0) {
        return cryptoFallback;
      }

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

    // For Crypto IDX and crypto, prioritize crypto feed
    if (sym === 'CRYPTO_IDX' || sym.includes('/USD') && ['BTC/USD', 'ETH/USD', 'BNB/USD'].includes(sym)) {
      const cryptoPrice = await fetchCryptoPrice(sym);
      if (cryptoPrice !== null) return cryptoPrice;
    }

    const activeKey = customApiKey || ENV.TWELVE_DATA_API_KEY;

    if (!hasApiKey(activeKey)) {
      const cryptoPrice = await fetchCryptoPrice(sym);
      if (cryptoPrice !== null) return cryptoPrice;
      dataUnavailable('Twelve Data API key not configured.');
    }

    const cacheKey = `price:${sym}`;
    const cached = cacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    // Check if we have recent candles cached for this symbol to save rate limits
    for (const tf of ['5min', '1min', '15min']) {
      for (const size of [100, 50, 30]) {
        const cachedCandles = cacheService.get<OHLCCandle[]>(`candles:${sym}:${tf}:${size}:${activeKey?.slice(-4) || 'default'}`);
        if (cachedCandles && cachedCandles.length > 0) {
          const latestPrice = cachedCandles[0].close;
          cacheService.set(cacheKey, latestPrice, 15);
          return latestPrice;
        }
      }
    }

    const querySymbol = sym === 'CRYPTO_IDX' ? 'BTC/USD' : sym;
    const scale = sym === 'CRYPTO_IDX' ? 0.065 : 1.0;

    try {
      const response = await axios.get(`${TWELVE_DATA_BASE}/price`, {
        params: { symbol: querySymbol, apikey: activeKey },
        timeout: 15000,
      });

      const body = response.data as { price?: string; code?: number; message?: string };

      if (body.code || !body.price) {
        const cryptoPrice = await fetchCryptoPrice(sym);
        if (cryptoPrice !== null) return cryptoPrice;
        dataUnavailable(body.message ?? 'Could not retrieve current price');
      }

      const price = parseFloat((parseFloat(body.price!) * scale).toFixed(2));
      cacheService.set(cacheKey, price, 30); // 30s cache for price
      return price;
    } catch (err) {
      const cryptoPrice = await fetchCryptoPrice(sym);
      if (cryptoPrice !== null) return cryptoPrice;

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
};

export default marketDataService;
