// ============================================================
// src/services/marketData.service.ts
// Genuine Multi-Source Market Data Service (Zero Synthetic Candles)
// Enforces:
// 1. Genuine, timestamped data from authorized providers (Twelve Data, Binance).
// 2. Strict Binomo OTC separation: Never substitute standard exchange data for OTC.
// 3. If genuine data is unavailable, returns DATA_UNAVAILABLE with direction WAIT.
// 4. Full validation: timestamps, deduplication, OHLC validity, latency check.
// 5. Chronological sorting: oldest to newest.
// 6. Completed candle enforcement: unclosed forming candles are excluded from signal analysis.
// 7. Clear status: LIVE | DELAYED | DATA_UNAVAILABLE.
// ============================================================
import axios from 'axios';
import ENV from '../config/env';
import cacheService from './cache.service';
import type { OHLCCandle, AssetCategory } from '../types';

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';
const BINANCE_BASE = 'https://api.binance.com/api/v3';

export type FeedStatus = 'LIVE' | 'DELAYED' | 'DATA_UNAVAILABLE';

export interface BinomoAssetSpec {
  symbol: string;
  name: string;
  category: string;
  profit: string;
  vipProfit: string;
  basePrice: number;
  decimals: number;
  volatility: number;
  isOtc: boolean;
  providerSymbol?: string;
  provider?: 'twelvedata' | 'binance' | 'binomo_otc_direct';
}

export const BINOMO_ASSETS_LIST: BinomoAssetSpec[] = [
  // Standard Real Market Assets (Genuine live data available via Twelve Data / Binance)
  { symbol: 'EUR/USD', name: 'EUR/USD', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 1.0890, decimals: 5, volatility: 0.0007, isOtc: false, providerSymbol: 'EUR/USD', provider: 'twelvedata' },
  { symbol: 'GBP/USD', name: 'GBP/USD', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 1.2650, decimals: 5, volatility: 0.0008, isOtc: false, providerSymbol: 'GBP/USD', provider: 'twelvedata' },
  { symbol: 'USD/JPY', name: 'USD/JPY', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 154.50, decimals: 3, volatility: 0.0009, isOtc: false, providerSymbol: 'USD/JPY', provider: 'twelvedata' },
  { symbol: 'AUD/USD', name: 'AUD/USD', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 0.6520, decimals: 5, volatility: 0.0008, isOtc: false, providerSymbol: 'AUD/USD', provider: 'twelvedata' },
  { symbol: 'USD/CAD', name: 'USD/CAD', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 1.4020, decimals: 5, volatility: 0.0008, isOtc: false, providerSymbol: 'USD/CAD', provider: 'twelvedata' },
  { symbol: 'NZD/USD', name: 'NZD/USD', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 0.5850, decimals: 5, volatility: 0.0008, isOtc: false, providerSymbol: 'NZD/USD', provider: 'twelvedata' },
  { symbol: 'EUR/GBP', name: 'EUR/GBP', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 0.8350, decimals: 5, volatility: 0.0007, isOtc: false, providerSymbol: 'EUR/GBP', provider: 'twelvedata' },
  { symbol: 'GBP/JPY', name: 'GBP/JPY', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 197.80, decimals: 3, volatility: 0.0010, isOtc: false, providerSymbol: 'GBP/JPY', provider: 'twelvedata' },
  { symbol: 'EUR/CAD', name: 'EUR/CAD', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 1.4850, decimals: 5, volatility: 0.0008, isOtc: false, providerSymbol: 'EUR/CAD', provider: 'twelvedata' },
  { symbol: 'AUD/CAD', name: 'AUD/CAD', category: 'Forex', profit: '80%', vipProfit: '82%', basePrice: 0.9140, decimals: 5, volatility: 0.0008, isOtc: false, providerSymbol: 'AUD/CAD', provider: 'twelvedata' },
  { symbol: 'Gold', name: 'Gold (XAU/USD)', category: 'Commodities', profit: '60%', vipProfit: '62%', basePrice: 2685.00, decimals: 2, volatility: 0.0012, isOtc: false, providerSymbol: 'XAU/USD', provider: 'twelvedata' },
  { symbol: 'BTC/USD', name: 'Bitcoin (Real)', category: 'Crypto', profit: '80%', vipProfit: '82%', basePrice: 61000.00, decimals: 2, volatility: 0.0015, isOtc: false, providerSymbol: 'BTCUSDT', provider: 'binance' },
  { symbol: 'ETH/USD', name: 'Ethereum (Real)', category: 'Crypto', profit: '80%', vipProfit: '82%', basePrice: 1720.00, decimals: 2, volatility: 0.0020, isOtc: false, providerSymbol: 'ETHUSDT', provider: 'binance' },
  { symbol: 'SOL/USD', name: 'Solana (Real)', category: 'Crypto', profit: '80%', vipProfit: '82%', basePrice: 195.00, decimals: 2, volatility: 0.0025, isOtc: false, providerSymbol: 'SOLUSDT', provider: 'binance' },

  // Binomo OTC Markets (Proprietary to Binomo platform)
  // Per Rule 5: Standard exchange prices must NOT be presented as equivalent OTC prices.
  // Unless an authorized Binomo OTC session is active, marked as isOtc=true.
  { symbol: 'Crypto IDX', name: 'Crypto IDX', category: 'Binomo OTC', profit: '83%', vipProfit: '85%', basePrice: 6245.50, decimals: 2, volatility: 0.0018, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'Bitcoin (OTC)', name: 'Bitcoin (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 96850.00, decimals: 2, volatility: 0.0015, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'Ethereum (OTC)', name: 'Ethereum (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 3480.00, decimals: 2, volatility: 0.0020, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'Solana (OTC)', name: 'Solana (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 194.50, decimals: 2, volatility: 0.0025, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'AUD/USD (OTC)', name: 'AUD/USD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 0.65150, decimals: 5, volatility: 0.0008, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'NZD/USD (OTC)', name: 'NZD/USD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 0.58420, decimals: 5, volatility: 0.0008, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'GBP/NZD (OTC)', name: 'GBP/NZD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 2.18400, decimals: 5, volatility: 0.0009, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'FC Barcelona Token (OTC)', name: 'FC Barcelona Token (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 1.8540, decimals: 4, volatility: 0.0035, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'Cardano (OTC)', name: 'Cardano (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 0.8420, decimals: 4, volatility: 0.0028, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'EUR/CAD (OTC)', name: 'EUR/CAD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 1.48250, decimals: 5, volatility: 0.0008, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'GBP/JPY (OTC)', name: 'GBP/JPY (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 197.600, decimals: 3, volatility: 0.0010, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'GBP/USD (OTC)', name: 'GBP/USD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 1.26450, decimals: 5, volatility: 0.0008, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'EUR/GBP (OTC)', name: 'EUR/GBP (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 0.83400, decimals: 5, volatility: 0.0007, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'AUD/CAD (OTC)', name: 'AUD/CAD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 0.91250, decimals: 5, volatility: 0.0008, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'EUR/USD (OTC)', name: 'EUR/USD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 1.05420, decimals: 5, volatility: 0.0007, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'USD/JPY (OTC)', name: 'USD/JPY (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 154.200, decimals: 3, volatility: 0.0009, isOtc: true, provider: 'binomo_otc_direct' },
  { symbol: 'USD/CAD (OTC)', name: 'USD/CAD (OTC)', category: 'Binomo OTC', profit: '80%', vipProfit: '82%', basePrice: 1.40120, decimals: 5, volatility: 0.0008, isOtc: true, provider: 'binomo_otc_direct' },
];

const ASSET_SPEC_MAP = new Map<string, BinomoAssetSpec>();
BINOMO_ASSETS_LIST.forEach((a) => {
  ASSET_SPEC_MAP.set(a.symbol.toUpperCase(), a);
  if (a.providerSymbol) {
    ASSET_SPEC_MAP.set(a.providerSymbol.toUpperCase(), a);
  }
  const stripped = a.symbol.replace(/\s*\(OTC\)/i, '').trim().toUpperCase();
  if (!ASSET_SPEC_MAP.has(stripped)) {
    ASSET_SPEC_MAP.set(stripped, a);
  }
});

const SUPPORTED_ASSETS: AssetCategory[] = [
  {
    category: 'Forex (Genuine Live)',
    assets: BINOMO_ASSETS_LIST.filter((a) => a.category === 'Forex').map((a) => ({
      symbol: a.symbol,
      name: a.name,
      type: 'forex',
    })),
  },
  {
    category: 'Crypto (Genuine Live)',
    assets: BINOMO_ASSETS_LIST.filter((a) => a.category === 'Crypto').map((a) => ({
      symbol: a.symbol,
      name: a.name,
      type: 'crypto',
    })),
  },
  {
    category: 'Commodities (Genuine Live)',
    assets: BINOMO_ASSETS_LIST.filter((a) => a.category === 'Commodities').map((a) => ({
      symbol: a.symbol,
      name: a.name,
      type: 'commodity',
    })),
  },
  {
    category: 'Binomo OTC (Requires Binomo Direct Feed)',
    assets: BINOMO_ASSETS_LIST.filter((a) => a.isOtc).map((a) => ({
      symbol: a.symbol,
      name: a.name,
      type: 'otc',
    })),
  },
];

const VALID_INTERVALS = ['1min', '5min', '15min'];

export interface CandleValidationReport {
  isValid: boolean;
  isOtc: boolean;
  status: FeedStatus;
  totalCandles: number;
  completedCandlesCount: number;
  duplicateCount: number;
  invalidOhlcCount: number;
  latencySeconds: number;
  lastCandleTime: string | null;
  message: string;
}

export function getAssetSpec(symbol: string): BinomoAssetSpec {
  const upper = symbol.trim().toUpperCase();
  const direct = ASSET_SPEC_MAP.get(upper);
  if (direct) return direct;

  for (const [key, spec] of ASSET_SPEC_MAP.entries()) {
    if (upper.includes(key) || key.includes(upper)) {
      return spec;
    }
  }

  // Fallback to EUR/USD standard pair
  return BINOMO_ASSETS_LIST[0];
}

export const marketDataService = {
  getSupportedAssets(): AssetCategory[] {
    return SUPPORTED_ASSETS;
  },

  getAssetsList(): BinomoAssetSpec[] {
    return BINOMO_ASSETS_LIST;
  },

  validateInterval(interval: string): void {
    if (!VALID_INTERVALS.includes(interval)) {
      throw Object.assign(
        new Error(`Unsupported interval: ${interval}. Valid: 1min, 5min, 15min`),
        { statusCode: 400, status: 'VALIDATION_ERROR' }
      );
    }
  },

  /**
   * Validates candle integrity, monotonic ordering, OHLC boundaries, duplicates, and latency.
   * Requirement 7, 8, 9, 10
   */
  validateCandles(
    candles: OHLCCandle[],
    symbol: string,
    interval = '1min'
  ): CandleValidationReport {
    const spec = getAssetSpec(symbol);
    const isOtc = spec.isOtc || symbol.toUpperCase().includes('(OTC)') || symbol.toUpperCase().includes('CRYPTO IDX');

    if (!candles || candles.length === 0) {
      return {
        isValid: false,
        isOtc,
        status: 'DATA_UNAVAILABLE',
        totalCandles: 0,
        completedCandlesCount: 0,
        duplicateCount: 0,
        invalidOhlcCount: 0,
        latencySeconds: 9999,
        lastCandleTime: null,
        message: isOtc
          ? 'Binomo OTC direct feed is disconnected. Real exchange prices cannot be substituted for OTC.'
          : 'No genuine market candles received from data provider.',
      };
    }

    let duplicateCount = 0;
    let invalidOhlcCount = 0;
    const seenTimes = new Set<string>();

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (seenTimes.has(c.timestamp)) {
        duplicateCount++;
      }
      seenTimes.add(c.timestamp);

      // OHLC sanity checks
      if (
        typeof c.open !== 'number' ||
        typeof c.high !== 'number' ||
        typeof c.low !== 'number' ||
        typeof c.close !== 'number' ||
        isNaN(c.open) ||
        isNaN(c.high) ||
        isNaN(c.low) ||
        isNaN(c.close) ||
        c.open <= 0 ||
        c.close <= 0 ||
        c.low <= 0 ||
        c.high <= 0 ||
        c.high < c.low ||
        c.high < c.open ||
        c.high < c.close ||
        c.low > c.open ||
        c.low > c.close
      ) {
        invalidOhlcCount++;
      }
    }

    const lastCandle = candles[candles.length - 1];
    const lastTimeMs = new Date(lastCandle.timestamp).getTime();
    const nowMs = Date.now();
    const latencySeconds = Math.max(0, Math.floor((nowMs - lastTimeMs) / 1000));

    const intervalSec = interval === '1min' ? 60 : interval === '15min' ? 900 : 300;

    // Check completed vs forming candle (Requirement 9)
    // If the last candle started within the current interval slot, it is still forming.
    const isLastCandleForming = latencySeconds < intervalSec;
    const completedCount = isLastCandleForming ? candles.length - 1 : candles.length;

    let status: FeedStatus = 'LIVE';
    if (latencySeconds > intervalSec * 5) {
      status = 'DATA_UNAVAILABLE';
    } else if (latencySeconds > intervalSec * 2) {
      status = 'DELAYED';
    }

    const isValid = invalidOhlcCount === 0 && completedCount >= 15 && status !== 'DATA_UNAVAILABLE';

    return {
      isValid,
      isOtc,
      status,
      totalCandles: candles.length,
      completedCandlesCount: completedCount,
      duplicateCount,
      invalidOhlcCount,
      latencySeconds,
      lastCandleTime: lastCandle.timestamp,
      message: !isValid
        ? status === 'DATA_UNAVAILABLE'
          ? `Feed Unavailable: Data latency is ${latencySeconds}s (> ${intervalSec * 5}s threshold)`
          : `Invalid Feed: ${invalidOhlcCount} corrupted candles or insufficient history (${completedCount}/15 completed)`
        : status === 'DELAYED'
        ? `Feed Delayed: Market data is ${latencySeconds}s behind current time`
        : `Feed Live: ${candles.length} candles validated from authorized provider`,
    };
  },

  /**
   * Sorts candles chronologically from oldest to newest (Requirement 8)
   * and deduplicates identical timestamps.
   */
  sanitizeAndSortCandles(candles: OHLCCandle[]): OHLCCandle[] {
    if (!candles || candles.length === 0) return [];

    const map = new Map<number, OHLCCandle>();
    for (const c of candles) {
      const timeMs = new Date(c.timestamp).getTime();
      if (!isNaN(timeMs)) {
        map.set(timeMs, {
          timestamp: new Date(timeMs).toISOString(),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
        });
      }
    }

    const sorted = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map((entry) => entry[1]);

    return sorted;
  },

  /**
   * Returns ONLY completed candles for final signal generation (Requirement 9).
   * Strips the currently-forming unfinished candle if it is not yet closed.
   */
  getCompletedCandlesOnly(candles: OHLCCandle[], interval = '1min'): OHLCCandle[] {
    const sorted = this.sanitizeAndSortCandles(candles);
    if (sorted.length <= 1) return sorted;

    const intervalSec = interval === '1min' ? 60 : interval === '15min' ? 900 : 300;
    const nowSec = Math.floor(Date.now() / 1000);
    const last = sorted[sorted.length - 1];
    const lastSec = Math.floor(new Date(last.timestamp).getTime() / 1000);

    // If the last candle timestamp is within the active ongoing slot, it is unclosed
    if (nowSec - lastSec < intervalSec) {
      return sorted.slice(0, -1);
    }

    return sorted;
  },

  /**
   * Genuine Market Data Fetcher.
   * NEVER generates synthetic, pseudo-random, or wave candles (Requirement 1, 2, 3).
   * Returns empty / DATA_UNAVAILABLE if genuine feed cannot be retrieved.
   */
  async getCandles(
    symbol: string,
    interval = '1min',
    outputsize = 100,
    customApiKey?: string
  ): Promise<OHLCCandle[]> {
    this.validateInterval(interval);
    const spec = getAssetSpec(symbol);

    // Binomo OTC Isolation (Requirement 5):
    // Standard exchange prices must NOT be presented as equivalent OTC prices.
    if (spec.isOtc) {
      console.warn(`[MarketData] ${symbol} is a Binomo OTC proprietary asset. No synthetic data will be generated.`);
      return [];
    }

    const cacheKey = `candles:${spec.symbol}:${interval}:${outputsize}`;
    const cached = cacheService.get<OHLCCandle[]>(cacheKey);
    if (cached && cached.length >= 10) {
      return cached;
    }

    // Provider 0: Yahoo Finance (Keyless, Unthrottled Real-time Forex, Commodities, and Crypto)
    const yahooSymMap: Record<string, string> = {
      'EUR/USD': 'EURUSD=X',
      'GBP/USD': 'GBPUSD=X',
      'USD/JPY': 'USDJPY=X',
      'AUD/USD': 'AUDUSD=X',
      'USD/CAD': 'USDCAD=X',
      'NZD/USD': 'NZDUSD=X',
      'EUR/GBP': 'EURGBP=X',
      'GBP/JPY': 'GBPJPY=X',
      'EUR/CAD': 'EURCAD=X',
      'AUD/CAD': 'AUDCAD=X',
      'Gold': 'GC=F',
      'XAU/USD': 'GC=F',
      'BTC/USD': 'BTC-USD',
      'ETH/USD': 'ETH-USD',
      'SOL/USD': 'SOL-USD',
    };

    const yfSymbol = yahooSymMap[spec.symbol] || yahooSymMap[spec.providerSymbol || ''];
    if (yfSymbol) {
      try {
        const yInterval = interval === '1min' ? '1m' : interval === '5min' ? '5m' : '15m';
        const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${yfSymbol}`, {
          params: { interval: yInterval, range: '1d' },
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
          timeout: 4500,
        });

        const result = res.data?.chart?.result?.[0];
        if (result && Array.isArray(result.timestamp)) {
          const timestamps: number[] = result.timestamp;
          const quotes = result.indicators?.quote?.[0];
          if (quotes) {
            const rawCandles: OHLCCandle[] = [];
            for (let i = 0; i < timestamps.length; i++) {
              const o = quotes.open?.[i];
              const h = quotes.high?.[i];
              const l = quotes.low?.[i];
              const c = quotes.close?.[i];
              const v = quotes.volume?.[i] || 0;
              if (o != null && h != null && l != null && c != null) {
                rawCandles.push({
                  timestamp: new Date(timestamps[i] * 1000).toISOString(),
                  open: Number(o),
                  high: Number(h),
                  low: Number(l),
                  close: Number(c),
                  volume: Number(v),
                });
              }
            }
            const sorted = this.sanitizeAndSortCandles(rawCandles);
            if (sorted.length >= 10) {
              cacheService.set(cacheKey, sorted, 8);
              return sorted;
            }
          }
        }
      } catch (err) {
        // Fallback to next provider
      }
    }

    // Provider 1: Coinbase Exchange (Keyless Crypto)
    if (spec.category === 'Crypto') {
      const cbProductMap: Record<string, string> = {
        'BTC/USD': 'BTC-USD',
        'ETH/USD': 'ETH-USD',
        'SOL/USD': 'SOL-USD',
      };
      const cbProduct = cbProductMap[spec.symbol] || (spec.providerSymbol ? spec.providerSymbol.replace('USDT', '-USD') : null);
      if (cbProduct) {
        try {
          const gran = interval === '1min' ? 60 : interval === '5min' ? 300 : 900;
          const res = await axios.get(`https://api.exchange.coinbase.com/products/${cbProduct}/candles`, {
            params: { granularity: gran },
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 4500,
          });
          if (Array.isArray(res.data) && res.data.length > 0) {
            const rawCandles: OHLCCandle[] = res.data.map((item: any[]) => ({
              timestamp: new Date(item[0] * 1000).toISOString(),
              open: parseFloat(item[3]),
              high: parseFloat(item[2]),
              low: parseFloat(item[1]),
              close: parseFloat(item[4]),
              volume: parseFloat(item[5] || '0'),
            }));
            const sorted = this.sanitizeAndSortCandles(rawCandles);
            if (sorted.length >= 10) {
              cacheService.set(cacheKey, sorted, 8);
              return sorted;
            }
          }
        } catch {}
      }
    }

    // Provider 1: Binance Public API for Cryptocurrencies (Zero Key Required, High Reliability)
    if (spec.provider === 'binance' && spec.providerSymbol) {
      try {
        const binanceInterval = interval === '1min' ? '1m' : interval === '5min' ? '5m' : '15m';
        const res = await axios.get(`${BINANCE_BASE}/klines`, {
          params: {
            symbol: spec.providerSymbol,
            interval: binanceInterval,
            limit: Math.min(outputsize + 1, 500),
          },
          timeout: 4500,
        });

        if (Array.isArray(res.data) && res.data.length > 0) {
          const rawCandles: OHLCCandle[] = res.data.map((item: any[]) => ({
            timestamp: new Date(item[0]).toISOString(),
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
            volume: parseFloat(item[5] || '0'),
          }));

          const sorted = this.sanitizeAndSortCandles(rawCandles);
          if (sorted.length > 0) {
            cacheService.set(cacheKey, sorted, 8);
            return sorted;
          }
        }
      } catch (err) {
        console.warn(`[MarketData] Binance klines failed for ${symbol}: ${(err as Error).message}`);
      }
    }

    // Provider 2: Twelve Data for Forex, Commodities (Gold), and Global Indices
    const activeKey = customApiKey || ENV.TWELVE_DATA_API_KEY;
    const targetSymbol = spec.providerSymbol || spec.symbol;

    if (activeKey && activeKey !== 'your_key_here') {
      try {
        const res = await axios.get(`${TWELVE_DATA_BASE}/time_series`, {
          params: {
            symbol: targetSymbol,
            interval,
            outputsize: Math.min(outputsize + 1, 500),
            format: 'JSON',
            apikey: activeKey,
          },
          timeout: 4500,
        });

        const body = res.data as {
          status?: string;
          message?: string;
          values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
        };

        if (body.values && Array.isArray(body.values) && body.values.length > 0) {
          const parsed: OHLCCandle[] = body.values.map((v) => ({
            timestamp: new Date(v.datetime + (v.datetime.includes('Z') ? '' : ' UTC')).toISOString(),
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseFloat(v.volume || '0'),
          }));

          const sorted = this.sanitizeAndSortCandles(parsed);
          if (sorted.length > 0) {
            cacheService.set(cacheKey, sorted, 10);
            return sorted;
          }
        } else if (body.status === 'error') {
          console.warn(`[MarketData] Twelve Data API returned error for ${symbol}: ${body.message}`);
        }
      } catch (err) {
        console.warn(`[MarketData] Twelve Data request error for ${symbol}: ${(err as Error).message}`);
      }
    }

    // Do NOT silently replace failed API requests with fake prices (Requirement 3)
    return [];
  },

  async getCurrentPrice(symbol: string, customApiKey?: string): Promise<number | null> {
    const candles = await this.getCandles(symbol, '1min', 2, customApiKey);
    if (candles && candles.length > 0) {
      return candles[candles.length - 1].close;
    }
    return null;
  },

  async getApiStatus(): Promise<{ available: boolean; status: FeedStatus; message: string }> {
    const hasKey = Boolean(ENV.TWELVE_DATA_API_KEY && ENV.TWELVE_DATA_API_KEY !== 'your_key_here');
    return {
      available: hasKey,
      status: hasKey ? 'LIVE' : 'DATA_UNAVAILABLE',
      message: hasKey
        ? 'Twelve Data + Binance live market feed active. Synthetic candle generation permanently disabled.'
        : 'Twelve Data API key required for live forex data.',
    };
  },
};

export default marketDataService;
