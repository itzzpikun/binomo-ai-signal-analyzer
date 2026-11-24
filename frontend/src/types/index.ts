// ============================================================
// All TypeScript types for the Binomo AI Signal Analyzer
// ============================================================

export type SignalDirection = 'CALL' | 'PUT' | 'WAIT';
export type OutcomeType = 'WIN' | 'LOSS' | 'PENDING';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error';
export type TimeInterval = '1min' | '5min' | '15min';

export interface Candle {
  time: number; // Unix timestamp (seconds)
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  source?: 'real' | 'simulated';
}

export interface Indicators {
  rsi?: number | null;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  } | null;
  ema9?: number | null;
  ema21?: number | null;
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
}

export interface SignalReasons {
  bullish: string[];
  bearish: string[];
}

export interface EntryTiming {
  rule_en?: string;
  rule_hi?: string;
  recommended_action?: string;
  entry_window?: string;
  expiry_duration?: string;
  confluence_count?: number;
  quality_tier?: string;
  quality_label?: string;
}

export interface GeminiArbiterResult {
  status: 'active' | 'disabled' | 'fallback' | 'cached';
  provider?: 'gemini' | 'openai' | 'fallback' | 'none';
  model?: string;
  approved: boolean;
  direction: SignalDirection;
  confidence: number;
  trap_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  analysis_en: string;
  analysis_hi: string;
  verdict: string;
}

export interface Signal {
  id?: string;
  symbol: string;
  interval: TimeInterval;
  timestamp: string; // ISO string
  direction: SignalDirection;
  confidence: number; // 0–100
  indicators: any;
  reasons: SignalReasons;
  outcome?: OutcomeType | null;
  verifiedAt?: string | null;
  trade_quality?: string;
  entry_timing?: EntryTiming;
  confluence_score?: number;
  gemini_arbiter?: GeminiArbiterResult;
  source?: 'real' | 'simulated';
}

export interface Asset {
  symbol: string;
  name: string;
  category: AssetCategory;
  pip?: number;
  isOtc?: boolean;
  source?: 'real' | 'simulated';
  status?: string;
}

export type AssetCategory = 'Forex' | 'Crypto' | 'Commodities' | 'Indices' | 'Binomo OTC';

export const ASSET_CATEGORIES: Record<AssetCategory, Asset[]> = {
  Forex: [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/GBP', name: 'Euro / British Pound', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/JPY', name: 'British Pound / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/CAD', name: 'Euro / Canadian Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/CAD', name: 'Australian Dollar / Canadian Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
  ],
  Crypto: [
    { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', category: 'Crypto', isOtc: false, source: 'real', status: 'available' },
    { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', category: 'Crypto', isOtc: false, source: 'real', status: 'available' },
    { symbol: 'BNB/USD', name: 'BNB / US Dollar', category: 'Crypto', isOtc: false, source: 'real', status: 'available' },
    { symbol: 'SOL/USD', name: 'Solana / US Dollar', category: 'Crypto', isOtc: false, source: 'real', status: 'available' },
  ],
  Commodities: [
    { symbol: 'XAU/USD', name: 'Gold / US Dollar', category: 'Commodities', isOtc: false, source: 'real', status: 'available' },
    { symbol: 'XAG/USD', name: 'Silver / US Dollar', category: 'Commodities', isOtc: false, source: 'real', status: 'available' },
    { symbol: 'OIL/USD', name: 'Crude Oil / US Dollar', category: 'Commodities', isOtc: false, source: 'real', status: 'available' },
  ],
  Indices: [
    { symbol: 'US30', name: 'Dow Jones Industrial Average', category: 'Indices', isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NAS100', name: 'Nasdaq 100', category: 'Indices', isOtc: false, source: 'real', status: 'available' },
    { symbol: 'SPX500', name: 'S&P 500', category: 'Indices', isOtc: false, source: 'real', status: 'available' },
  ],
  'Binomo OTC': [
    { symbol: 'CRYPTO_IDX', name: 'Crypto IDX (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'EUR/USD (OTC)', name: 'Euro / US Dollar (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'GBP/USD (OTC)', name: 'British Pound / US Dollar (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'USD/JPY (OTC)', name: 'US Dollar / Japanese Yen (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'AUD/CAD (OTC)', name: 'Australian Dollar / Canadian Dollar (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'BTC/USD (OTC)', name: 'Bitcoin (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
  ],
};

export interface BacktestParams {
  symbol: string;
  interval: TimeInterval;
  startDate: string;
  endDate: string;
  indicators?: string[];
}

export interface BacktestResult {
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
  equityCurve: { timestamp: string; equity: number }[];
  signals: Signal[];
}

export interface PerformanceSummary {
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
  bestAsset: string | null;
  byAsset: AssetPerformance[];
  byTimeframe: TimeframePerformance[];
}

export interface AssetPerformance {
  symbol: string;
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
}

export interface TimeframePerformance {
  interval: TimeInterval;
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
}

export interface ApiError {
  status: 'DATA_UNAVAILABLE' | 'ERROR';
  message: string;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: string;
}

export interface WebSocketMessage {
  type: 'price_update' | 'signal_update' | 'error' | 'connected' | 'subscribed';
  data?: PriceUpdate | Signal | { message: string };
}
