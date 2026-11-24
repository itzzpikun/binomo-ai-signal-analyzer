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
  payout?: number;
}

export function getAssetPayout(symbol: string): number {
  if (symbol === 'Crypto IDX') return 83;
  if (symbol === 'GBP/USD') return 70;
  if (symbol === 'Gold') return 60;
  if (['GBP/HUF', 'EUR/PLN', 'ZAR/JPY', 'CHF/HUF'].includes(symbol)) return 50;
  return 80;
}

export type AssetCategory = 'Forex' | 'Crypto' | 'Commodities' | 'Binomo OTC';

export const ASSET_CATEGORIES: Record<AssetCategory, Asset[]> = {
  Forex: [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/CAD', name: 'Australian Dollar / Canadian Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/CHF', name: 'Australian Dollar / Swiss Franc', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/NZD', name: 'Australian Dollar / New Zealand Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/JPY', name: 'Australian Dollar / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/SGD', name: 'Australian Dollar / Singapore Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/NOK', name: 'Australian Dollar / Norwegian Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/SEK', name: 'Australian Dollar / Swedish Krona', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/DKK', name: 'Australian Dollar / Danish Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/HUF', name: 'Australian Dollar / Hungarian Forint', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'AUD/ZAR', name: 'Australian Dollar / South African Rand', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CAD/JPY', name: 'Canadian Dollar / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CAD/SEK', name: 'Canadian Dollar / Swedish Krona', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CAD/NOK', name: 'Canadian Dollar / Norwegian Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CAD/MXN', name: 'Canadian Dollar / Mexican Peso', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CAD/DKK', name: 'Canadian Dollar / Danish Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CAD/SGD', name: 'Canadian Dollar / Singapore Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CHF/JPY', name: 'Swiss Franc / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CHF/SGD', name: 'Swiss Franc / Singapore Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CHF/NOK', name: 'Swiss Franc / Norwegian Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CHF/DKK', name: 'Swiss Franc / Danish Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'CHF/HUF', name: 'Swiss Franc / Hungarian Forint', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/HUF', name: 'Euro / Hungarian Forint', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/MXN', name: 'Euro / Mexican Peso', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/ILS', name: 'Euro / Israeli Shekel', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/ZAR', name: 'Euro / South African Rand', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/NOK', name: 'Euro / Norwegian Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/NZD', name: 'Euro / New Zealand Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/SEK', name: 'Euro / Swedish Krona', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/SGD', name: 'Euro / Singapore Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'EUR/PLN', name: 'Euro / Polish Zloty', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/CAD', name: 'British Pound / Canadian Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/NZD', name: 'British Pound / New Zealand Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/HKD', name: 'British Pound / Hong Kong Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/HUF', name: 'British Pound / Hungarian Forint', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/DKK', name: 'British Pound / Danish Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/NOK', name: 'British Pound / Norwegian Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/SGD', name: 'British Pound / Singapore Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/PLN', name: 'British Pound / Polish Zloty', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/MXN', name: 'British Pound / Mexican Peso', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'GBP/CZK', name: 'British Pound / Czech Koruna', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NOK/SEK', name: 'Norwegian Krone / Swedish Krona', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NOK/JPY', name: 'Norwegian Krone / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/CAD', name: 'New Zealand Dollar / Canadian Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/CHF', name: 'New Zealand Dollar / Swiss Franc', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/JPY', name: 'New Zealand Dollar / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/SGD', name: 'New Zealand Dollar / Singapore Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/NOK', name: 'New Zealand Dollar / Norwegian Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/SEK', name: 'New Zealand Dollar / Swedish Krona', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/DKK', name: 'New Zealand Dollar / Danish Krone', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'NZD/HUF', name: 'New Zealand Dollar / Hungarian Forint', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'SEK/JPY', name: 'Swedish Krona / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'SGD/JPY', name: 'Singapore Dollar / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'SGD/HKD', name: 'Singapore Dollar / Hong Kong Dollar', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/SEK', name: 'US Dollar / Swedish Krona', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/ZAR', name: 'US Dollar / South African Rand', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/PLN', name: 'US Dollar / Polish Zloty', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/CZK', name: 'US Dollar / Czech Koruna', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/HUF', name: 'US Dollar / Hungarian Forint', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/ILS', name: 'US Dollar / Israeli Shekel', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'USD/MXN', name: 'US Dollar / Mexican Peso', category: 'Forex', pip: 0.0001, isOtc: false, source: 'real', status: 'available' },
    { symbol: 'ZAR/JPY', name: 'South African Rand / Japanese Yen', category: 'Forex', pip: 0.01, isOtc: false, source: 'real', status: 'available' },
  ],
  Crypto: [
    { symbol: 'Crypto IDX', name: 'Crypto IDX (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Bitcoin (OTC)', name: 'Bitcoin (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Ethereum (OTC)', name: 'Ethereum (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Solana (OTC)', name: 'Solana (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Aave (OTC)', name: 'Aave (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Uniswap (OTC)', name: 'Uniswap (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Chainlink (OTC)', name: 'Chainlink (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Pancake Swap (OTC)', name: 'Pancake Swap (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Kusama (OTC)', name: 'Kusama (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Bitcoin Cash (OTC)', name: 'Bitcoin Cash (OTC)', category: 'Crypto', isOtc: true, source: 'simulated', status: 'no real data available' },
  ],
  Commodities: [
    { symbol: 'Gold', name: 'Gold / US Dollar', category: 'Commodities', isOtc: false, source: 'real', status: 'available' },
  ],
  'Binomo OTC': [
    { symbol: 'Crypto IDX', name: 'Crypto IDX (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Bitcoin (OTC)', name: 'Bitcoin (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Ethereum (OTC)', name: 'Ethereum (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Solana (OTC)', name: 'Solana (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Aave (OTC)', name: 'Aave (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Uniswap (OTC)', name: 'Uniswap (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Chainlink (OTC)', name: 'Chainlink (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Pancake Swap (OTC)', name: 'Pancake Swap (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Kusama (OTC)', name: 'Kusama (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'Bitcoin Cash (OTC)', name: 'Bitcoin Cash (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
    { symbol: 'EUR/GBP (OTC)', name: 'Euro / British Pound (OTC)', category: 'Binomo OTC', isOtc: true, source: 'simulated', status: 'no real data available' },
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

export interface RiskStatus {
  negativeExpectancy: {
    active: boolean;
    sampleSize: number;
    winRate: number;
    expectancyPerTrade: number;
    message?: string;
  };
  dailyLimit: {
    active: boolean;
    lossesToday: number;
    pnlToday: number;
    pnlTodayPct: number;
    reason?: string;
    message?: string;
  };
}

export interface Trade {
  _id?: string;
  time: string | Date;
  asset: string;
  direction: 'CALL' | 'PUT';
  entry: number;
  expiry: string;
  stake: number;
  result: 'WIN' | 'LOSS' | 'PENDING' | 'TIE';
  exitPrice?: number;
  pnl?: number;
  notes?: string;
  source?: 'real' | 'manual' | 'signal';
}

export interface PerformanceSummary {
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
  bestAsset: string | null;
  totalPnL?: number;
  profitFactor?: number;
  byAsset: AssetPerformance[];
  byTimeframe: TimeframePerformance[];
  riskStatus?: RiskStatus;
  note?: string;
}

export interface AssetPerformance {
  symbol: string;
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
  pnl?: number;
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
