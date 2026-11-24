// ============================================================
// All TypeScript types for the Binomo AI Signal Analyzer
// ============================================================

export type SignalDirection = 'CALL' | 'PUT' | 'WAIT';
export type OutcomeType = 'WIN' | 'LOSS' | 'PENDING';
export type ConnectionStatus = 'connected' | 'disconnected' | 'error';
export type TimeInterval = '1min' | '5min' | '15min';
export type FeedStatus = 'LIVE' | 'DELAYED' | 'DATA_UNAVAILABLE';

export interface DataQualityReport {
  isValid: boolean;
  feedStatus: FeedStatus;
  message: string;
  source: string;
  candleCount: number;
  duplicateCount: number;
  latencySeconds: number;
  lastCandleTimestamp: string | null;
  anomaliesDetected: string[];
}

export interface TimeframeAlignment {
  '1m': SignalDirection;
  '5m': SignalDirection;
  '15m': SignalDirection;
  isAligned: boolean;
  conflictDetected: boolean;
}

export interface TradeRiskAdvice {
  isTradePermitted: boolean;
  status: 'PERMITTED' | 'DAILY_LIMIT_HALT' | 'COOLDOWN_ACTIVE';
  recommendedStake: number;
  maxAllowedStake: number;
  reason: string;
  cooldownRemainingSeconds: number;
  antiMartingaleWarning: string;
}

export interface RiskSettings {
  bankroll: number;
  maxStakePercentage: number;
  dailyLossLimitPercentage: number;
  maxConsecutiveLosses: number;
  cooldownMinutes: number;
}

export interface RiskState {
  currentDailyLoss: number;
  consecutiveLosses: number;
  isDailyLimitBreached: boolean;
  isCooldownActive: boolean;
  cooldownUntil: string | null;
  tradesTodayCount: number;
  dailyWins: number;
  dailyLosses: number;
  lastUpdated: string;
}

export interface Candle {
  time: number; // Unix timestamp (seconds)
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
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

export interface NextProbableSetup {
  bias: 'CALL' | 'PUT';
  biasPercentage: number;
  bullishPower: number;
  bearishPower: number;
  watchTrigger: string;
  setupSummary: string;
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
  score_breakdown?: {
    trendScore: number;
    momentumScore: number;
    priceActionScore: number;
    mtfScore: number;
    volatilityScore: number;
    totalScore: number;
  };
  market_regime?: 'TRENDING' | 'RANGING' | 'VOLATILE';
  next_probable_setup?: NextProbableSetup;
  gemini_arbiter?: GeminiArbiterResult;
  data_quality?: DataQualityReport;
  timeframe_alignment?: TimeframeAlignment;
  risk_advice?: TradeRiskAdvice;
}

export interface Asset {
  symbol: string;
  name: string;
  category: AssetCategory;
  pip?: number;
  profit?: string;
  vipProfit?: string;
  isOTC?: boolean;
}

export type AssetCategory = 'Binomo OTC' | 'Forex' | 'Crypto' | 'Commodities' | 'Indices';

export const BINOMO_SCREENSHOT_ASSETS: Asset[] = [
  { symbol: 'Crypto IDX', name: 'Crypto IDX', category: 'Crypto', profit: '83%', vipProfit: '85%' },
  { symbol: 'Bitcoin (OTC)', name: 'Bitcoin (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Ethereum (OTC)', name: 'Ethereum (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Solana (OTC)', name: 'Solana (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'AUD/USD (OTC)', name: 'AUD/USD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'NZD/USD (OTC)', name: 'NZD/USD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'GBP/NZD (OTC)', name: 'GBP/NZD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Gold', name: 'Gold', category: 'Commodities', profit: '60%', vipProfit: '62%' },
  { symbol: 'FC Barcelona Token (OTC)', name: 'FC Barcelona Token (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Cardano (OTC)', name: 'Cardano (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'EUR/CAD (OTC)', name: 'EUR/CAD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'GBP/JPY (OTC)', name: 'GBP/JPY (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'GBP/USD (OTC)', name: 'GBP/USD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'EUR/GBP (OTC)', name: 'EUR/GBP (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'AUD/CAD (OTC)', name: 'AUD/CAD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'EUR/USD (OTC)', name: 'EUR/USD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'USD/JPY (OTC)', name: 'USD/JPY (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'USD/CAD (OTC)', name: 'USD/CAD (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Kusama (OTC)', name: 'Kusama (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Aave (OTC)', name: 'Aave (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Chainlink (OTC)', name: 'Chainlink (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'GBP/CHF (OTC)', name: 'GBP/CHF (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Bitcoin Cash (OTC)', name: 'Bitcoin Cash (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Uniswap (OTC)', name: 'Uniswap (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'CHF/JPY (OTC)', name: 'CHF/JPY (OTC)', category: 'Forex', profit: '80%', vipProfit: '82%', isOTC: true },
  { symbol: 'Pancake Swap (OTC)', name: 'Pancake Swap (OTC)', category: 'Crypto', profit: '80%', vipProfit: '82%', isOTC: true },
];

export const ASSET_CATEGORIES: Record<AssetCategory, Asset[]> = {
  'Binomo OTC': BINOMO_SCREENSHOT_ASSETS,
  Forex: BINOMO_SCREENSHOT_ASSETS.filter((a) => a.category === 'Forex'),
  Crypto: BINOMO_SCREENSHOT_ASSETS.filter((a) => a.category === 'Crypto'),
  Commodities: BINOMO_SCREENSHOT_ASSETS.filter((a) => a.category === 'Commodities'),
  Indices: [
    { symbol: 'Crypto IDX', name: 'Crypto IDX', category: 'Indices', profit: '83%', vipProfit: '85%' },
    { symbol: 'US30', name: 'Dow Jones Industrial Average', category: 'Indices', profit: '70%', vipProfit: '72%' },
    { symbol: 'NAS100', name: 'Nasdaq 100', category: 'Indices', profit: '70%', vipProfit: '72%' },
  ],
};

export interface BacktestParams {
  symbol: string;
  interval: TimeInterval;
  startDate: string;
  endDate: string;
  indicators?: string[];
}

export interface WalkForwardPartition {
  trades: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  evPerTrade: number;
  profitFactor: number;
  maxDrawdown: number;
  maxConsecutiveLosses: number;
}

export interface BacktestResult {
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  ties?: number;
  accuracy: number;
  breakEvenWinRate?: number;
  evPerTrade?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  maxConsecutiveLosses?: number;
  wilson95ConfidenceInterval?: { lower: number; upper: number };
  inSample?: WalkForwardPartition;
  outOfSample?: WalkForwardPartition;
  equityCurve: { timestamp: string; equity: number }[];
  signals: Signal[];
  disclaimer?: string;
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
