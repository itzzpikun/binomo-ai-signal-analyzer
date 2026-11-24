// ============================================================
// src/types/index.ts — Shared TypeScript types
// ============================================================

export interface OHLCCandle {
  timestamp: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source?: 'real' | 'simulated';
}

export type Direction = 'CALL' | 'PUT' | 'WAIT';
export type Outcome = 'WIN' | 'LOSS' | 'PENDING';

export interface SignalReasons {
  bullish: string[];
  bearish: string[];
}

export interface SignalIndicators {
  rsi?: number;
  macd?: { line: number; signal: number; histogram: number };
  bb?: { upper: number; middle: number; lower: number };
  ema9?: number;
  ema21?: number;
  [key: string]: unknown;
}

export interface SignalResult {
  direction: Direction;
  confidence: number;
  indicators: SignalIndicators;
  reasons: SignalReasons;
  source?: 'real' | 'simulated';
  trade_quality?: string;
  entry_timing?: any;
}

export interface AnalyzeRequest {
  symbol: string;
  interval: string;
  candles: OHLCCandle[];
  source?: 'real' | 'simulated';
}

export interface BacktestRequest {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  indicators: string[];
}

export interface BacktestResult {
  totalSignals: number;
  verifiedSignals: number;
  wins: number;
  losses: number;
  accuracy: number;
  signals: BacktestSignalEntry[];
  disclaimer: string;
}

export interface BacktestSignalEntry {
  timestamp: string;
  direction: Direction;
  confidence: number;
  outcome: Outcome;
}

export interface AssetCategory {
  category: string;
  assets: AssetInfo[];
}

export interface AssetInfo {
  symbol: string;
  name: string;
  type: string;
  isOtc?: boolean;
  source?: 'real' | 'simulated';
}

export interface ApiError {
  status: string;
  message: string;
  code?: number;
}
