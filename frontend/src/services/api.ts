import axios from 'axios';
import type {
  Candle,
  Asset,
  Signal,
  BacktestParams,
  BacktestResult,
  PerformanceSummary,
  TimeInterval,
  Trade,
  RiskStatus,
} from '../types';

// In production (served from Express), VITE_API_URL is empty → relative URLs (same origin)
// In dev, falls back to localhost:5001 (proxied by Vite)
const API_BASE = import.meta.env.VITE_API_URL ?? '';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 45000, // Generous timeout for Render free-tier cold starts (~30-60s)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Retry wrapper — retries up to 3 times with exponential backoff on network/timeout errors
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    config.__retryCount = config.__retryCount || 0;

    // Retry on network errors, timeouts, 502/503/504 (Render cold start)
    const isRetryable =
      !error.response ||
      [502, 503, 504].includes(error.response?.status);

    if (isRetryable && config.__retryCount < 3) {
      config.__retryCount += 1;
      const delay = Math.min(1000 * Math.pow(2, config.__retryCount - 1), 5000);
      console.log(`[API] Retry ${config.__retryCount}/3 after ${delay}ms...`);
      await sleep(delay);
      return apiClient(config);
    }

    if (error.response) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject({
      status: 'ERROR',
      message: error.message || 'Network error',
    });
  }
);

// ----------------------------------------------------------------
// Market Data
// ----------------------------------------------------------------

export interface CandlesResponse {
  status: string;
  symbol: string;
  interval: string;
  source?: 'real' | 'simulated';
  candles: Candle[];
}

export interface PriceResponse {
  status: string;
  symbol: string;
  price: number;
  timestamp: string;
}

export interface AssetsResponse {
  status: string;
  assets: Asset[];
}

export interface MarketStatusResponse {
  status: 'connected' | 'disconnected' | 'error';
  provider: string;
  message?: string;
}

export const getCandles = async (
  symbol: string,
  interval: TimeInterval,
  outputsize = 100
): Promise<CandlesResponse> => {
  const response = await apiClient.get('/api/market/candles', {
    params: {
      symbol,
      interval,
      outputsize,
    },
  });
  return response.data;
};

export const getCurrentPrice = async (symbol: string): Promise<PriceResponse> => {
  const response = await apiClient.get('/api/market/price', {
    params: {
      symbol,
    },
  });
  return response.data;
};

export const getAssets = async (): Promise<AssetsResponse> => {
  const response = await apiClient.get('/api/market/assets');
  return response.data;
};

export const getMarketStatus = async (): Promise<MarketStatusResponse> => {
  const response = await apiClient.get('/api/market/status');
  return response.data;
};

// ----------------------------------------------------------------
// Signal Analysis
// ----------------------------------------------------------------

export interface AnalyzeSignalParams {
  symbol: string;
  interval: TimeInterval;
  candles: Candle[];
}

export interface SignalHistoryResponse {
  status: string;
  signals: Signal[];
  total: number;
}

export interface OpenRouterClientConfig {
  apiKey: string;
  model: string;
}

export const OPENROUTER_KEY_STORAGE = 'openrouter_api_key';
export const OPENROUTER_MODEL_STORAGE = 'openrouter_model';

export const getOpenRouterConfig = (): OpenRouterClientConfig => {
  if (typeof window === 'undefined') return { apiKey: '', model: 'openrouter/free' };
  return {
    apiKey: (localStorage.getItem(OPENROUTER_KEY_STORAGE) || '').trim(),
    model: (localStorage.getItem(OPENROUTER_MODEL_STORAGE) || 'openrouter/free').trim(),
  };
};

export const OPENROUTER_UPDATED_EVENT = 'binomo:openrouter-updated';

export const saveOpenRouterConfig = (apiKey: string, model: string): void => {
  if (typeof window === 'undefined') return;
  const trimmedKey = apiKey.trim();
  const trimmedModel = model.trim() || 'openrouter/free';
  if (trimmedKey) {
    localStorage.setItem(OPENROUTER_KEY_STORAGE, trimmedKey);
  } else {
    localStorage.removeItem(OPENROUTER_KEY_STORAGE);
  }
  localStorage.setItem(OPENROUTER_MODEL_STORAGE, trimmedModel);
  window.dispatchEvent(new CustomEvent(OPENROUTER_UPDATED_EVENT));
};

export const getAiHealth = async (): Promise<{
  ai?: { provider: string; configured: boolean; model: string };
  services?: { ai_engine: string };
}> => {
  const response = await apiClient.get('/health');
  return response.data;
};

export const analyzeSignal = async (params: AnalyzeSignalParams): Promise<Signal> => {
  // Ensure every candle has an ISO timestamp string required by the backend and AI engine
  const formattedCandles = params.candles.map((c) => ({
    timestamp:
      (c as any).timestamp ||
      (c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString()),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume || 0),
  }));

  const { apiKey, model } = getOpenRouterConfig();
  const headers: Record<string, string> = {};
  if (apiKey) headers['X-OpenRouter-Key'] = apiKey;
  if (model) headers['X-OpenRouter-Model'] = model;

  const response = await apiClient.post(
    '/api/signal/analyze',
    {
      symbol: params.symbol,
      interval: params.interval,
      candles: formattedCandles,
      ...(model ? { openrouter_model: model } : {}),
    },
    { headers }
  );

  const data = response.data;
  const sig = data.signal || data;

  return {
    ...sig,
    id: data.signalId || sig.id || sig._id,
    symbol: data.symbol || sig.symbol || params.symbol,
    interval: data.interval || sig.interval || params.interval,
    timestamp: sig.timestamp || data.timestamp || new Date().toISOString(),
    direction: sig.direction || 'WAIT',
    confidence: typeof sig.confidence === 'number' ? sig.confidence : 0,
    indicators: sig.indicators || {},
    reasons: sig.reasons || { bullish: [], bearish: [] },
    trade_quality: sig.trade_quality,
    entry_timing: sig.entry_timing,
    confluence_score: sig.confluence_score,
    patterns: Array.isArray(sig.patterns) ? sig.patterns : [],
    ai_arbiter: sig.ai_arbiter,
    source: data.source || sig.source,
  };
};

export const getSignalHistory = async (
  symbol?: string,
  limit = 50
): Promise<SignalHistoryResponse> => {
  const response = await apiClient.get('/api/signal/history', {
    params: { symbol, limit },
  });
  return response.data;
};

export const verifySignal = async (
  signalId: string,
  outcome: 'WIN' | 'LOSS'
): Promise<Signal> => {
  const response = await apiClient.post('/api/signal/verify', {
    signalId,
    outcome,
  });
  return response.data;
};

// ----------------------------------------------------------------
// Backtesting
// ----------------------------------------------------------------

export const runBacktest = async (params: BacktestParams): Promise<BacktestResult> => {
  const response = await apiClient.post('/api/backtest/run', params);
  return response.data;
};

// ----------------------------------------------------------------
// Performance & Trades
// ----------------------------------------------------------------

export const getPerformance = async (): Promise<PerformanceSummary> => {
  const response = await apiClient.get('/api/performance/summary');
  return response.data;
};

export const getTrades = async (limit = 100, asset?: string): Promise<{ trades: Trade[]; riskStatus: RiskStatus }> => {
  const params: Record<string, any> = { limit };
  if (asset) params.asset = asset;
  const response = await apiClient.get('/api/trades', { params });
  return response.data;
};

export const logTrade = async (trade: Partial<Trade>): Promise<{ trade: Trade }> => {
  const response = await apiClient.post('/api/trades', trade);
  return response.data;
};

export const updateTrade = async (id: string, result: 'WIN' | 'LOSS' | 'PENDING' | 'TIE', exitPrice?: number): Promise<{ trade: Trade }> => {
  const response = await apiClient.patch(`/api/trades/${id}`, { result, exitPrice });
  return response.data;
};

export const getRiskStatus = async (): Promise<{ riskStatus: RiskStatus }> => {
  const response = await apiClient.get('/api/trades/risk-status');
  return response.data;
};

export const scanAllAssets = async (): Promise<{ status: string; scanned: number; signals: any[]; timestamp: string }> => {
  const response = await apiClient.get('/api/scan/all');
  return response.data;
};

// Namespace object for convenience (api.getCandles, api.analyzeSignal, etc.)
export const api = {
  scanAll: () => scanAllAssets(),
  getCandles: (symbol: string, interval: TimeInterval, outputsize = 100) =>
    getCandles(symbol, interval, outputsize).then(r => {
      if ((r as any).status === 'DATA_UNAVAILABLE') return r;
      return r.candles ?? r;
    }),
  getCurrentPrice: (symbol: string) => getCurrentPrice(symbol),
  getAssets: () => getAssets().then(r => r.assets ?? r),
  getMarketStatus: () => getMarketStatus(),
  analyzeSignal: (symbol: string, interval: TimeInterval, candles: Candle[]) =>
    analyzeSignal({ symbol, interval, candles }),
  getSignalHistory: (symbol?: string, limit = 50) =>
    getSignalHistory(symbol, limit).then(r => r.signals ?? r),
  verifySignal: (signalId: string, outcome: 'WIN' | 'LOSS') =>
    verifySignal(signalId, outcome),
  runBacktest: (params: BacktestParams) => runBacktest(params),
  getPerformance: () => getPerformance(),
  getTrades: (limit = 100, asset?: string) => getTrades(limit, asset),
  logTrade: (trade: Partial<Trade>) => logTrade(trade),
  updateTrade: (id: string, result: 'WIN' | 'LOSS' | 'PENDING' | 'TIE', exitPrice?: number) => updateTrade(id, result, exitPrice),
  getRiskStatus: () => getRiskStatus(),
};

export default apiClient;

