import axios from 'axios';
import type {
  Candle,
  Asset,
  Signal,
  BacktestParams,
  BacktestResult,
  PerformanceSummary,
  TimeInterval,
} from '../types';

// In production (served from Express), VITE_API_URL is empty → relative URLs (same origin)
// In dev, falls back to localhost:5001 (proxied by Vite)
const API_BASE = import.meta.env.VITE_API_URL ?? '';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Automatically attach stored AI provider keys
apiClient.interceptors.request.use((config) => {
  try {
    const rawKeys = localStorage.getItem('binomo_ai_keys');
    if (rawKeys) {
      const keys = JSON.parse(rawKeys);
      if (keys.geminiKey) config.headers['x-gemini-key'] = keys.geminiKey;
      if (keys.openaiKey) config.headers['x-openai-key'] = keys.openaiKey;
      if (keys.groqKey) config.headers['x-groq-key'] = keys.groqKey;
      if (keys.deepseekKey) config.headers['x-deepseek-key'] = keys.deepseekKey;
      if (keys.openrouterKey) config.headers['x-openrouter-key'] = keys.openrouterKey;
    }
  } catch {}
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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

  const response = await apiClient.post(
    '/api/signal/analyze',
    {
      symbol: params.symbol,
      interval: params.interval,
      candles: formattedCandles,
    }
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
    next_probable_setup: sig.next_probable_setup || data.next_probable_setup,
    gemini_arbiter: sig.gemini_arbiter,
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
// Multi-Asset Background Scanner
// ----------------------------------------------------------------

export interface MultiAssetSignal {
  symbol: string;
  direction: 'CALL' | 'PUT';
  confidence: number;
  trade_quality: string;
  timeframes?: {
    '1m': string;
    '5m': string;
    '15m': string;
  };
  entry_timing: any;
  next_probable_setup?: any;
  reasons?: {
    bullish: string[];
    bearish: string[];
  };
  timestamp: string;
}

export interface MultiAssetScanResponse {
  status: string;
  scanned: number;
  active_signals: number;
  signals: MultiAssetSignal[];
  timestamp: string;
}

export const scanAllAssets = async (interval = '1min'): Promise<MultiAssetScanResponse> => {
  const response = await apiClient.get('/api/scan/all', {
    params: { interval },
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
// Performance
// ----------------------------------------------------------------

export const getPerformance = async (): Promise<PerformanceSummary> => {
  const response = await apiClient.get('/api/performance/summary');
  return response.data;
};

export const testAIKey = async (provider: string, apiKey: string) => {
  const response = await apiClient.post('/api/ai/test-key', { provider, apiKey });
  return response.data;
};

export const getAIProviders = async () => {
  const response = await apiClient.get('/api/ai/providers');
  return response.data;
};

// Namespace object for convenience (api.getCandles, api.analyzeSignal, etc.)
export const api = {
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
  scanAllAssets: (interval = '1min') => scanAllAssets(interval),
  runBacktest: (params: BacktestParams) => runBacktest(params),
  getPerformance: () => getPerformance(),
  testAIKey: (provider: string, apiKey: string) => testAIKey(provider, apiKey),
  getAIProviders: () => getAIProviders(),
};

export default apiClient;

