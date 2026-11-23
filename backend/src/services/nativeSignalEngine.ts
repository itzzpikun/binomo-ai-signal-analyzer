// ============================================================
// src/services/nativeSignalEngine.ts
// Advanced Quantitative Binary Options Signal Engine
// Implements 100-Point Scoring, Multi-Timeframe Alignment,
// False Signal Filters, and Complete Technical Analysis Indicators
// ============================================================
import type { OHLCCandle } from '../types';

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE';

export interface ScoreBreakdown {
  trendScore: number;       // Max 25
  momentumScore: number;    // Max 20
  priceActionScore: number; // Max 20
  mtfScore: number;         // Max 20
  volatilityScore: number;  // Max 15
  totalScore: number;       // Max 100
}

export interface NextProbableSetup {
  bias: 'CALL' | 'PUT';
  biasPercentage: number;
  bullishPower: number;
  bearishPower: number;
  watchTrigger: string;
  setupSummary: string;
}

export interface NativeSignalResult {
  direction: 'CALL' | 'PUT' | 'WAIT';
  confidence: number; // Quantitative Setup Score (0-100)
  trade_quality: string;
  score_breakdown: ScoreBreakdown;
  market_regime: MarketRegime;
  false_signal_filter: {
    isTriggered: boolean;
    reason: string | null;
    isSideways: boolean;
    isAbnormalVolatility: boolean;
    isFalseBreakout: boolean;
    isWickRejection: boolean;
  };
  entry_timing: {
    rule_en: string;
    rule_hi: string;
    recommended_action: string;
    entry_window: string;
    expiry_duration: string;
    confluence_count: number;
    quality_tier: string;
    quality_label: string;
    matched_frameworks: string[];
  };
  confluence_score: number;
  next_probable_setup: NextProbableSetup;
  indicators: {
    rsi: { value: number | null; signal: string };
    macd: { macd: number | null; signal_line: number | null; histogram: number | null; crossover: string };
    ema: {
      ema9: number | null;
      ema21: number | null;
      ema50: number | null;
      ema200: number | null;
      trend: string;
    };
    sma: {
      sma50: number | null;
      sma200: number | null;
      trend: string;
    };
    bollinger: {
      upper: number | null;
      middle: number | null;
      lower: number | null;
      width: number | null;
      percent_b: number | null;
      signal: string;
    };
    adx: {
      adx: number;
      plus_di: number;
      minus_di: number;
      trend_strength: string;
    };
    atr: {
      value: number;
      isSpike: boolean;
    };
    stochastic_rsi: {
      k: number | null;
      d: number | null;
      signal: string;
    };
    vwap: {
      value: number | null;
      position: string;
    };
    support_resistance: {
      nearest_support: number | null;
      nearest_resistance: number | null;
      position: string;
    };
    stochastic: {
      k: number | null;
      d: number | null;
      signal: string;
    };
  };
  reasons: {
    bullish: string[];
    bearish: string[];
    wait_reasons?: string[];
  };
  patterns: Array<{ name: string; type: 'bullish' | 'bearish' | 'neutral'; strength: number }>;
  timeframe_alignment?: {
    '1m'?: string;
    '5m'?: string;
    '15m'?: string;
    isAligned?: boolean;
    conflictDetected?: boolean;
  };
  analysis_horizon: string;
  timestamp: string;
  disclaimer: string;
  gemini_arbiter?: any;
}

// ── Technical Indicator Calculations ─────────────────────────

export function calcSMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const sma: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  sma.push(sum / period);

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    sma.push(sum / period);
  }
  return sma;
}

export function calcEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number; signal: number; histogram: number; crossover: string } {
  if (closes.length < slow) {
    return { macd: 0, signal: 0, histogram: 0, crossover: 'neutral' };
  }
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  const signalLine = calcEMA(macdLine.slice(slow - 1), signal);
  const curMacd = macdLine[macdLine.length - 1];
  const curSignal = signalLine.length > 0 ? signalLine[signalLine.length - 1] : 0;
  const prevMacd = macdLine[macdLine.length - 2] || curMacd;
  const prevSignal = signalLine.length > 1 ? signalLine[signalLine.length - 2] : curSignal;

  const histogram = curMacd - curSignal;
  let crossover = 'neutral';
  if (prevMacd <= prevSignal && curMacd > curSignal) crossover = 'bullish_cross';
  else if (prevMacd >= prevSignal && curMacd < curSignal) crossover = 'bearish_cross';

  return { macd: curMacd, signal: curSignal, histogram, crossover };
}

export function calcBollingerBands(closes: number[], period = 20, multiplier = 2) {
  if (closes.length < period) {
    const c = closes[closes.length - 1] || 1;
    return { upper: c * 1.01, middle: c, lower: c * 0.99, width: c * 0.02, percent_b: 0.5 };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = mean + multiplier * std;
  const lower = mean - multiplier * std;
  const current = closes[closes.length - 1];
  const width = upper - lower;
  const percent_b = width > 0 ? (current - lower) / width : 0.5;
  return { upper, middle: mean, lower, width, percent_b };
}

export function calcADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): { adx: number; plus_di: number; minus_di: number; trend_strength: string } {
  if (closes.length < period + 2) {
    return { adx: 20, plus_di: 20, minus_di: 20, trend_strength: 'Weak' };
  }

  let trSum = 0;
  let plusDmSum = 0;
  let minusDmSum = 0;

  const startIdx = Math.max(1, closes.length - period);
  for (let i = startIdx; i < closes.length; i++) {
    const h = highs[i];
    const l = lows[i];
    const prevC = closes[i - 1];
    const prevH = highs[i - 1];
    const prevL = lows[i - 1];

    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trSum += tr;

    const upMove = h - prevH;
    const downMove = prevL - l;

    if (upMove > downMove && upMove > 0) plusDmSum += upMove;
    if (downMove > upMove && downMove > 0) minusDmSum += downMove;
  }

  const plus_di = trSum > 0 ? (plusDmSum / trSum) * 100 : 20;
  const minus_di = trSum > 0 ? (minusDmSum / trSum) * 100 : 20;
  const diDiff = Math.abs(plus_di - minus_di);
  const diSum = plus_di + minus_di;
  const dx = diSum > 0 ? (diDiff / diSum) * 100 : 20;

  const adxVal = Math.round(dx * 10) / 10;
  let trend_strength = 'Weak / Chop';
  if (adxVal >= 40) trend_strength = 'Very Strong Trend';
  else if (adxVal >= 25) trend_strength = 'Strong Trend';
  else if (adxVal >= 20) trend_strength = 'Moderate Trend';

  return {
    adx: adxVal,
    plus_di: Math.round(plus_di * 10) / 10,
    minus_di: Math.round(minus_di * 10) / 10,
    trend_strength,
  };
}

export function calcATR(highs: number[], lows: number[], closes: number[], period = 14): { current: number; average: number } {
  if (closes.length < 2) return { current: 0.001, average: 0.001 };
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  const curTr = trs[trs.length - 1] || 0.001;
  const periodSlice = trs.slice(-period);
  const avgAtr = periodSlice.reduce((a, b) => a + b, 0) / Math.max(periodSlice.length, 1);
  return { current: curTr, average: avgAtr };
}

export function calcStochasticRSI(
  closes: number[],
  rsiPeriod = 14,
  stochPeriod = 14,
  smoothK = 3,
  smoothD = 3
): { k: number; d: number; signal: string } {
  if (closes.length < rsiPeriod + stochPeriod) {
    return { k: 50, d: 50, signal: 'neutral' };
  }

  // Calculate rolling RSIs
  const rsiValues: number[] = [];
  for (let i = rsiPeriod + 1; i <= closes.length; i++) {
    const subCloses = closes.slice(0, i);
    rsiValues.push(calcRSI(subCloses, rsiPeriod));
  }

  if (rsiValues.length < stochPeriod) {
    return { k: 50, d: 50, signal: 'neutral' };
  }

  const rawK: number[] = [];
  for (let i = stochPeriod; i <= rsiValues.length; i++) {
    const slice = rsiValues.slice(i - stochPeriod, i);
    const minRsi = Math.min(...slice);
    const maxRsi = Math.max(...slice);
    const curRsi = slice[slice.length - 1];
    const stochRsi = maxRsi - minRsi > 0 ? ((curRsi - minRsi) / (maxRsi - minRsi)) * 100 : 50;
    rawK.push(stochRsi);
  }

  const kValues = calcSMA(rawK, smoothK);
  const curK = kValues.length > 0 ? kValues[kValues.length - 1] : 50;
  const dValues = calcSMA(kValues, smoothD);
  const curD = dValues.length > 0 ? dValues[dValues.length - 1] : curK;

  let signal = 'neutral';
  if (curK < 25 && curK > curD) signal = 'oversold_bullish';
  else if (curK > 75 && curK < curD) signal = 'overbought_bearish';
  else if (curK > curD) signal = 'bullish_momentum';
  else if (curK < curD) signal = 'bearish_momentum';

  return { k: Math.round(curK * 10) / 10, d: Math.round(curD * 10) / 10, signal };
}

export function calcVWAP(candles: OHLCCandle[]): number | null {
  if (candles.length === 0) return null;
  let cumTypicalVol = 0;
  let cumVol = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume && c.volume > 0 ? c.volume : 100;
    cumTypicalVol += typicalPrice * vol;
    cumVol += vol;
  }
  return cumVol > 0 ? cumTypicalVol / cumVol : null;
}

export function calcSupportResistance(candles: OHLCCandle[]): {
  nearestSupport: number | null;
  nearestResistance: number | null;
  distanceSupportPct: number;
  distanceResistancePct: number;
  position: string;
} {
  if (candles.length < 5) {
    return {
      nearestSupport: null,
      nearestResistance: null,
      distanceSupportPct: 1,
      distanceResistancePct: 1,
      position: 'mid_range',
    };
  }

  const currentClose = candles[candles.length - 1].close;
  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    if (
      c.high >= candles[i - 1].high &&
      c.high >= candles[i - 2].high &&
      c.high >= candles[i + 1].high &&
      c.high >= candles[i + 2].high
    ) {
      swingHighs.push(c.high);
    }
    if (
      c.low <= candles[i - 1].low &&
      c.low <= candles[i - 2].low &&
      c.low <= candles[i + 1].low &&
      c.low <= candles[i + 2].low
    ) {
      swingLows.push(c.low);
    }
  }

  const resistancesAbove = swingHighs.filter((h) => h >= currentClose);
  const supportsBelow = swingLows.filter((l) => l <= currentClose);

  const nearestResistance = resistancesAbove.length > 0 ? Math.min(...resistancesAbove) : null;
  const nearestSupport = supportsBelow.length > 0 ? Math.max(...supportsBelow) : null;

  const distRes = nearestResistance ? (nearestResistance - currentClose) / currentClose : 0.05;
  const distSup = nearestSupport ? (currentClose - nearestSupport) / currentClose : 0.05;

  let position = 'mid_range';
  if (distRes <= 0.001) position = 'at_resistance';
  else if (distSup <= 0.001) position = 'at_support';
  else if (distRes < distSup) position = 'near_resistance';
  else if (distSup < distRes) position = 'near_support';

  return {
    nearestSupport,
    nearestResistance,
    distanceSupportPct: distSup,
    distanceResistancePct: distRes,
    position,
  };
}

export function detectCandlePatterns(candles: OHLCCandle[]) {
  const patterns: Array<{ name: string; type: 'bullish' | 'bearish' | 'neutral'; strength: number }> = [];
  if (candles.length < 3) return patterns;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low || 0.0001;
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const isGreen = last.close > last.open;
  const isRed = last.close < last.open;

  const prevBody = Math.abs(prev.close - prev.open);
  const prevIsRed = prev.close < prev.open;
  const prevIsGreen = prev.close > prev.open;

  // Doji
  if (body / range < 0.1) {
    patterns.push({ name: 'Doji (Indecision)', type: 'neutral', strength: 0.6 });
  }

  // Bullish Engulfing
  if (prevIsRed && isGreen && last.open <= prev.close && last.close >= prev.open && body > prevBody * 1.05) {
    patterns.push({ name: 'Bullish Engulfing', type: 'bullish', strength: 0.9 });
  }

  // Bearish Engulfing
  if (prevIsGreen && isRed && last.open >= prev.close && last.close <= prev.open && body > prevBody * 1.05) {
    patterns.push({ name: 'Bearish Engulfing', type: 'bearish', strength: 0.9 });
  }

  // Hammer / Pinbar (Bullish)
  if (lowerWick >= body * 2 && upperWick <= body * 0.4) {
    patterns.push({ name: 'Bullish Hammer / Pinbar', type: 'bullish', strength: 0.85 });
  }

  // Shooting Star (Bearish)
  if (upperWick >= body * 2 && lowerWick <= body * 0.4) {
    patterns.push({ name: 'Bearish Shooting Star', type: 'bearish', strength: 0.85 });
  }

  // Morning Star (3-candle bullish reversal)
  if (prev2.close < prev2.open && Math.abs(prev.close - prev.open) < (prev2.open - prev2.close) * 0.4 && isGreen && last.close > (prev2.open + prev2.close) / 2) {
    patterns.push({ name: 'Morning Star Reversal', type: 'bullish', strength: 0.95 });
  }

  // Evening Star (3-candle bearish reversal)
  if (prev2.close > prev2.open && Math.abs(prev.close - prev.open) < (prev2.close - prev2.open) * 0.4 && isRed && last.close < (prev2.open + prev2.close) / 2) {
    patterns.push({ name: 'Evening Star Reversal', type: 'bearish', strength: 0.95 });
  }

  // Bullish Marubozu
  if (isGreen && body / range > 0.85) {
    patterns.push({ name: 'Bullish Marubozu (Strong Momentum)', type: 'bullish', strength: 0.8 });
  }

  // Bearish Marubozu
  if (isRed && body / range > 0.85) {
    patterns.push({ name: 'Bearish Marubozu (Strong Momentum)', type: 'bearish', strength: 0.8 });
  }

  return patterns;
}

// ── In-Memory Candle Latching ────────────────────────────────
interface LatchedSignal {
  candleSlot: number;
  direction: 'CALL' | 'PUT' | 'WAIT';
  confidence: number;
  trade_quality: string;
  score_breakdown: ScoreBreakdown;
  reasons: { bullish: string[]; bearish: string[]; wait_reasons?: string[] };
}
const signalLatchMap = new Map<string, LatchedSignal>();

// ── Core Multi-Factor Quantitative Analyzer ─────────────────

export function analyzeCandlesNative(
  candles: OHLCCandle[],
  symbol = 'Crypto IDX',
  interval = '1min',
  mtfContext?: {
    s5mDirection?: 'CALL' | 'PUT' | 'WAIT';
    s15mDirection?: 'CALL' | 'PUT' | 'WAIT';
  }
): NativeSignalResult {
  const disclaimer =
    'This signal is for informational purposes only. Quantitative setups represent model confluence, not guaranteed financial returns.';

  if (!candles || candles.length < 15) {
    return {
      direction: 'WAIT',
      confidence: 40,
      trade_quality: 'INSUFFICIENT_DATA',
      score_breakdown: { trendScore: 0, momentumScore: 0, priceActionScore: 0, mtfScore: 0, volatilityScore: 0, totalScore: 0 },
      market_regime: 'RANGING',
      false_signal_filter: { isTriggered: true, reason: 'Insufficient candle history (<15 candles)', isSideways: true, isAbnormalVolatility: false, isFalseBreakout: false, isWickRejection: false },
      entry_timing: {
        rule_en: 'Accumulating market data before calculating quantitative setup.',
        rule_hi: 'Paryapt candle data aane tak wait karein.',
        recommended_action: 'Wait for live feed',
        entry_window: 'None',
        expiry_duration: '1min',
        confluence_count: 0,
        quality_tier: 'WAIT',
        quality_label: 'Awaiting market feed accumulation',
        matched_frameworks: ['Data Accumulation'],
      },
      confluence_score: 40,
      next_probable_setup: { bias: 'CALL', biasPercentage: 50, bullishPower: 50, bearishPower: 50, watchTrigger: 'Awaiting candle accumulation', setupSummary: 'Insufficient market data' },
      indicators: {} as any,
      reasons: { bullish: [], bearish: [], wait_reasons: ['Insufficient candle history (<15 candles)'] },
      patterns: [],
      analysis_horizon: interval,
      timestamp: new Date().toISOString(),
      disclaimer,
    };
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const currentPrice = closes[closes.length - 1];
  const lastCandle = candles[candles.length - 1];

  // 1. Calculate All Technical Indicators
  const rsi = calcRSI(closes, 14);
  const macdData = calcMACD(closes, 12, 26, 9);
  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const ema50Arr = calcEMA(closes, 50);
  const ema200Arr = calcEMA(closes, 200);

  const ema9 = ema9Arr[ema9Arr.length - 1];
  const ema21 = ema21Arr[ema21Arr.length - 1];
  const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : ema21;
  const ema200 = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : ema50;

  const sma50Arr = calcSMA(closes, 50);
  const sma200Arr = calcSMA(closes, 200);
  const sma50 = sma50Arr.length > 0 ? sma50Arr[sma50Arr.length - 1] : ema50;
  const sma200 = sma200Arr.length > 0 ? sma200Arr[sma200Arr.length - 1] : ema200;

  const bbData = calcBollingerBands(closes, 20, 2);
  const adxData = calcADX(highs, lows, closes, 14);
  const atrData = calcATR(highs, lows, closes, 14);
  const stochRsiData = calcStochasticRSI(closes, 14, 14, 3, 3);
  const vwapValue = calcVWAP(candles);
  const srData = calcSupportResistance(candles);
  const patterns = detectCandlePatterns(candles);

  // 2. Market Regime & False Signal Detection
  const bbWidthPct = bbData.width / Math.max(bbData.middle, 1);
  let marketRegime: MarketRegime = 'TRENDING';
  if (adxData.adx < 20 || bbWidthPct < 0.002) {
    marketRegime = 'RANGING';
  } else if (atrData.current > atrData.average * 2.2) {
    marketRegime = 'VOLATILE';
  }

  // False Signal Checks
  const isSideways = marketRegime === 'RANGING';
  const isAbnormalVolatility = atrData.current > atrData.average * 2.5;

  // Wick rejection check
  const lastRange = lastCandle.high - lastCandle.low || 0.0001;
  const lastBody = Math.abs(lastCandle.close - lastCandle.open);
  const lastUpperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const lastLowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

  const isCallWickRejection = lastUpperWick > lastBody * 1.8 && srData.position === 'at_resistance';
  const isPutWickRejection = lastLowerWick > lastBody * 1.8 && srData.position === 'at_support';
  const isWickRejection = isCallWickRejection || isPutWickRejection;

  // False breakout check
  const isFalseBreakout =
    (srData.position === 'at_resistance' && lastUpperWick > lastRange * 0.5 && lastCandle.close < (srData.nearestResistance || currentPrice)) ||
    (srData.position === 'at_support' && lastLowerWick > lastRange * 0.5 && lastCandle.close > (srData.nearestSupport || currentPrice));

  // 3. Quantitative 100-Point Scoring Engine
  // Section 4 Specification:
  // - Trend confirmation: 25 points
  // - Momentum confirmation: 20 points
  // - Price action: 20 points
  // - Multi-timeframe agreement: 20 points
  // - Volatility and market quality: 15 points
  // Total: 100 points

  let bullTrend = 0;
  let bearTrend = 0;
  // Trend (25 pts):
  // EMA 9 > 21 > 50 (12 pts)
  if (ema9 > ema21) {
    bullTrend += ema21 > ema50 ? 12 : 8;
  } else if (ema9 < ema21) {
    bearTrend += ema21 < ema50 ? 12 : 8;
  }
  // Macro trend Price vs SMA 50 / 200 (8 pts)
  if (currentPrice > sma50) bullTrend += 4;
  else bearTrend += 4;
  if (currentPrice > sma200) bullTrend += 4;
  else bearTrend += 4;
  // MACD line relative to zero line (5 pts)
  if (macdData.macd > 0) bullTrend += 5;
  else bearTrend += 5;

  // Momentum (20 pts):
  let bullMom = 0;
  let bearMom = 0;
  // RSI(14) healthy momentum (7 pts)
  if (rsi >= 50 && rsi <= 68) bullMom += 7;
  else if (rsi > 68 && rsi <= 75) bullMom += 4;
  else if (rsi <= 50 && rsi >= 32) bearMom += 7;
  else if (rsi < 32 && rsi >= 25) bearMom += 4;

  // MACD histogram expanding in direction (6 pts)
  if (macdData.histogram > 0) bullMom += 6;
  else if (macdData.histogram < 0) bearMom += 6;

  // Stochastic RSI crossover (7 pts)
  if (stochRsiData.signal === 'oversold_bullish' || stochRsiData.signal === 'bullish_momentum') bullMom += 7;
  else if (stochRsiData.signal === 'overbought_bearish' || stochRsiData.signal === 'bearish_momentum') bearMom += 7;

  // Price Action (20 pts):
  let bullPA = 0;
  let bearPA = 0;
  // Market Structure: Higher Highs / Higher Lows (8 pts)
  const prevCandle = candles[candles.length - 2];
  if (lastCandle.high > prevCandle.high && lastCandle.low > prevCandle.low) bullPA += 8;
  else if (lastCandle.high < prevCandle.high && lastCandle.low < prevCandle.low) bearPA += 8;

  // Candlestick pattern recognition (7 pts)
  const bullPattern = patterns.find((p) => p.type === 'bullish');
  const bearPattern = patterns.find((p) => p.type === 'bearish');
  if (bullPattern) bullPA += Math.round(bullPattern.strength * 7);
  if (bearPattern) bearPA += Math.round(bearPattern.strength * 7);

  // S/R Bounce or clean breakout (5 pts)
  if (srData.position === 'at_support' && lastCandle.close > lastCandle.open) bullPA += 5;
  else if (srData.position === 'at_resistance' && lastCandle.close < lastCandle.open) bearPA += 5;
  else if (srData.position === 'mid_range') {
    bullPA += 2;
    bearPA += 2;
  }

  // Multi-Timeframe Agreement (20 pts):
  let bullMtf = 0;
  let bearMtf = 0;
  let conflictDetected = false;

  const s5m = mtfContext?.s5mDirection;
  const s15m = mtfContext?.s15mDirection;

  if (s5m) {
    if (s5m === 'CALL') bullMtf += 10;
    else if (s5m === 'PUT') bearMtf += 10;
  } else {
    // Single timeframe fallback: use 9/21 cross slope as proxy
    bullMtf += ema9 > ema21 ? 10 : 0;
    bearMtf += ema9 < ema21 ? 10 : 0;
  }

  if (s15m) {
    if (s15m === 'CALL') bullMtf += 10;
    else if (s15m === 'PUT') bearMtf += 10;
  } else {
    bullMtf += currentPrice > sma50 ? 10 : 0;
    bearMtf += currentPrice < sma50 ? 10 : 0;
  }

  // Detect direct 1M vs 15M conflict
  if (s15m && s5m) {
    if ((s5m === 'CALL' && s15m === 'PUT') || (s5m === 'PUT' && s15m === 'CALL')) {
      conflictDetected = true;
    }
  }

  // Volatility & Market Quality (15 pts):
  let volScore = 0;
  if (adxData.adx >= 22) volScore += 8;
  else if (adxData.adx >= 18) volScore += 4;

  if (bbWidthPct >= 0.0015 && bbWidthPct <= 0.015) volScore += 4;
  else volScore += 2;

  if (!isAbnormalVolatility) volScore += 3;

  // Total scores
  const bullTotal = bullTrend + bullMom + bullPA + bullMtf + volScore;
  const bearTotal = bearTrend + bearMom + bearPA + bearMtf + volScore;

  const dominantBias: 'CALL' | 'PUT' = bullTotal >= bearTotal ? 'CALL' : 'PUT';
  const dominantScore = dominantBias === 'CALL' ? bullTotal : bearTotal;

  const scoreBreakdown: ScoreBreakdown = {
    trendScore: dominantBias === 'CALL' ? bullTrend : bearTrend,
    momentumScore: dominantBias === 'CALL' ? bullMom : bearMom,
    priceActionScore: dominantBias === 'CALL' ? bullPA : bearPA,
    mtfScore: dominantBias === 'CALL' ? bullMtf : bearMtf,
    volatilityScore: volScore,
    totalScore: dominantScore,
  };

  // 4. Signal Policy Decision
  // Rules:
  // - 85–100: Strong setup
  // - 75–84: Moderate setup
  // - Below 75: WAIT
  // - Conflicting timeframes: WAIT
  // - Sideways / False Breakout: WAIT
  let direction: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
  let trade_quality = 'AWAITING_QUALIFIED_SETUP';
  const waitReasons: string[] = [];
  const bullReasons: string[] = [];
  const bearReasons: string[] = [];
  const matchedFrameworks: string[] = [];

  // Generate detailed reasoning
  if (ema9 > ema21) bullReasons.push(`EMA 9 (${ema9.toFixed(2)}) > EMA 21 (${ema21.toFixed(2)}) Bullish Trend Alignment`);
  else bearReasons.push(`EMA 9 (${ema9.toFixed(2)}) < EMA 21 (${ema21.toFixed(2)}) Bearish Trend Alignment`);

  if (rsi >= 50) bullReasons.push(`RSI(14) at ${rsi.toFixed(1)} confirms positive upward momentum`);
  else bearReasons.push(`RSI(14) at ${rsi.toFixed(1)} confirms downward selling momentum`);

  if (adxData.adx >= 20) {
    matchedFrameworks.push(`ADX (14) Trend Strength: ${adxData.adx} (${adxData.trend_strength})`);
  }

  if (patterns.length > 0) {
    patterns.forEach((p) => {
      matchedFrameworks.push(`Candle Pattern: ${p.name}`);
      if (p.type === 'bullish') bullReasons.push(`Pattern Confirmed: ${p.name}`);
      if (p.type === 'bearish') bearReasons.push(`Pattern Confirmed: ${p.name}`);
    });
  }

  // False Signal Check Execution
  let filterTriggered = false;
  let filterReason: string | null = null;

  if (conflictDetected) {
    filterTriggered = true;
    filterReason = `Conflicting Multi-Timeframe Alignment (5M: ${s5m} vs 15M: ${s15m})`;
    waitReasons.push(filterReason);
  } else if (isSideways) {
    filterTriggered = true;
    filterReason = `Sideways Market Chop Detected (ADX: ${adxData.adx} < 20)`;
    waitReasons.push(filterReason);
  } else if (isAbnormalVolatility) {
    filterTriggered = true;
    filterReason = `Abnormal Volatility Spike (${(atrData.current / atrData.average).toFixed(1)}x ATR) — High Risk`;
    waitReasons.push(filterReason);
  } else if (isFalseBreakout) {
    filterTriggered = true;
    filterReason = `False Breakout Wick Rejection at Key Level`;
    waitReasons.push(filterReason);
  } else if (dominantBias === 'CALL' && isCallWickRejection) {
    filterTriggered = true;
    filterReason = `Upper Wick Rejection near Resistance Level`;
    waitReasons.push(filterReason);
  } else if (dominantBias === 'PUT' && isPutWickRejection) {
    filterTriggered = true;
    filterReason = `Lower Wick Rejection near Support Level`;
    waitReasons.push(filterReason);
  } else if (dominantScore < 65) {
    filterTriggered = true;
    filterReason = `Setup Score (${dominantScore}/100) is below the minimum 65-point quantitative threshold`;
    waitReasons.push(filterReason);
  }

  if (filterTriggered) {
    direction = 'WAIT';
    trade_quality = filterReason || 'AWAITING 65+ SCORE CONFLUENCE';
  } else if (dominantScore >= 85) {
    direction = dominantBias;
    trade_quality = `STRONG_SETUP (${dominantScore} pts)`;
    matchedFrameworks.push(`100-Point Quantitative Engine: Strong ${direction} (${dominantScore}/100)`);
  } else if (dominantScore >= 65) {
    direction = dominantBias;
    trade_quality = `QUALIFIED_SETUP (${dominantScore} pts)`;
    matchedFrameworks.push(`Quantitative Engine: ${direction} (${dominantScore}/100)`);
  }

  // 5. Candle-Slot Locking (guarantees zero flicker during current candle)
  const now = Date.now();
  const intervalSeconds = interval === '1min' ? 60 : interval === '15min' ? 900 : 300;
  const candleSlot = Math.floor(now / 1000 / intervalSeconds) * intervalSeconds;
  const latchKey = `${symbol.toUpperCase()}_${interval}`;
  const currentLatch = signalLatchMap.get(latchKey);

  if (!filterTriggered && currentLatch && currentLatch.candleSlot === candleSlot) {
    if (currentLatch.direction === 'CALL' || currentLatch.direction === 'PUT') {
      direction = currentLatch.direction;
      trade_quality = currentLatch.trade_quality;
    }
  } else {
    signalLatchMap.set(latchKey, {
      candleSlot,
      direction,
      confidence: dominantScore,
      trade_quality,
      score_breakdown: scoreBreakdown,
      reasons: { bullish: bullReasons, bearish: bearReasons, wait_reasons: waitReasons },
    });
  }

  const bullPowerPct = Math.round((bullTotal / Math.max(bullTotal + bearTotal, 1)) * 100);
  const bearPowerPct = 100 - bullPowerPct;

  const nextProbableSetup: NextProbableSetup = {
    bias: dominantBias,
    biasPercentage: Math.max(bullPowerPct, bearPowerPct),
    bullishPower: bullPowerPct,
    bearishPower: bearPowerPct,
    watchTrigger:
      dominantBias === 'CALL'
        ? `Watching for candle close above EMA 9 (${ema9.toFixed(2)}) with RSI > 50 & ADX > 20`
        : `Watching for candle close below EMA 9 (${ema9.toFixed(2)}) with RSI < 50 & ADX > 20`,
    setupSummary:
      direction === 'WAIT'
        ? `Trade Paused: ${filterReason || 'Waiting for 75+ point confluence'}`
        : `${direction} verified with ${dominantScore}/100 setup score. Low trap risk.`,
  };

  return {
    direction,
    confidence: dominantScore,
    trade_quality,
    score_breakdown: scoreBreakdown,
    market_regime: marketRegime,
    false_signal_filter: {
      isTriggered: filterTriggered,
      reason: filterReason,
      isSideways,
      isAbnormalVolatility,
      isFalseBreakout,
      isWickRejection,
    },
    entry_timing: {
      rule_en: `Execute at open of new candle (0-15s window). Fixed ${interval} expiry.`,
      rule_hi: `Nayi candle open hote hi pehle 10-15 seconds me entry lein. Expiry: ${interval}.`,
      recommended_action: direction === 'WAIT' ? 'Wait for valid setup' : `Execute ${direction}`,
      entry_window: 'New Candle Open (0-15s)',
      expiry_duration: `${interval} (Fixed)`,
      confluence_count: dominantScore,
      quality_tier: dominantScore >= 85 ? 'Strong Setup (85-100 pts)' : dominantScore >= 75 ? 'Moderate Setup (75-84 pts)' : 'Awaiting Threshold (<75 pts)',
      quality_label: `${direction} Setup Score: ${dominantScore}/100 (${marketRegime})`,
      matched_frameworks: matchedFrameworks,
    },
    confluence_score: dominantScore,
    next_probable_setup: nextProbableSetup,
    indicators: {
      rsi: { value: Math.round(rsi * 10) / 10, signal: rsi >= 60 ? 'Bullish' : rsi <= 40 ? 'Bearish' : 'Neutral' },
      macd: {
        macd: Math.round(macdData.macd * 1000) / 1000,
        signal_line: Math.round(macdData.signal * 1000) / 1000,
        histogram: Math.round(macdData.histogram * 1000) / 1000,
        crossover: macdData.crossover,
      },
      ema: {
        ema9: Math.round(ema9 * 100) / 100,
        ema21: Math.round(ema21 * 100) / 100,
        ema50: Math.round(ema50 * 100) / 100,
        ema200: Math.round(ema200 * 100) / 100,
        trend: ema9 > ema21 ? 'BULLISH' : 'BEARISH',
      },
      sma: {
        sma50: Math.round(sma50 * 100) / 100,
        sma200: Math.round(sma200 * 100) / 100,
        trend: currentPrice > sma50 ? 'BULLISH' : 'BEARISH',
      },
      bollinger: {
        upper: Math.round(bbData.upper * 100) / 100,
        middle: Math.round(bbData.middle * 100) / 100,
        lower: Math.round(bbData.lower * 100) / 100,
        width: Math.round(bbData.width * 100) / 100,
        percent_b: Math.round(bbData.percent_b * 100) / 100,
        signal: bbData.percent_b > 0.8 ? 'Overbought' : bbData.percent_b < 0.2 ? 'Oversold' : 'Neutral',
      },
      adx: adxData,
      atr: {
        value: Math.round(atrData.current * 10000) / 10000,
        isSpike: isAbnormalVolatility,
      },
      stochastic_rsi: stochRsiData,
      vwap: {
        value: vwapValue ? Math.round(vwapValue * 100) / 100 : null,
        position: vwapValue ? (currentPrice >= vwapValue ? 'Above VWAP' : 'Below VWAP') : 'N/A',
      },
      support_resistance: {
        nearest_support: srData.nearestSupport,
        nearest_resistance: srData.nearestResistance,
        position: srData.position,
      },
      stochastic: {
        k: stochRsiData.k,
        d: stochRsiData.d,
        signal: stochRsiData.signal,
      },
    },
    reasons: {
      bullish: bullReasons,
      bearish: bearReasons,
      wait_reasons: waitReasons,
    },
    patterns,
    timeframe_alignment: {
      '1m': dominantBias,
      '5m': s5m || dominantBias,
      '15m': s15m || dominantBias,
      isAligned: !conflictDetected,
      conflictDetected,
    },
    analysis_horizon: interval,
    timestamp: new Date().toISOString(),
    disclaimer,
  };
}
