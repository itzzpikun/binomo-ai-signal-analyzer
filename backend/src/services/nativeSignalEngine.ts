// ============================================================
// src/services/nativeSignalEngine.ts
// Advanced Quantitative Binary Options Signal Engine
// Phase 2: Real Multi-Timeframe Analysis (1M / 5M / 15M)
// Phase 3: Advanced Technical Analysis (EMA, SMA, ADX, RSI, MACD, AO, Stoch, S/R, ATR, BB)
// Phase 4: Strict Signal Quality & Anti-Loss Protection (Zero fake confidence, WAIT preference)
// ============================================================
import type { OHLCCandle } from '../types';

export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE';

export interface ScoreBreakdown {
  trendScore: number;       // Max 25 (EMA 9/21/50, SMA 50/200, ADX/DMI, MACD level)
  momentumScore: number;    // Max 20 (RSI 14, MACD Histogram, Stoch RSI, Awesome Oscillator)
  priceActionScore: number; // Max 20 (Structure, Patterns, S/R Bounce, VWAP)
  mtfScore: number;         // Max 20 (10 pts for 5M genuine confirmation, 10 pts for 15M)
  volatilityScore: number;  // Max 15 (ADX trend strength, BB width, ATR normalization)
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

export interface MTFContext {
  s5mDirection?: 'CALL' | 'PUT' | 'WAIT';
  s15mDirection?: 'CALL' | 'PUT' | 'WAIT';
  s5mScore?: number;
  s15mScore?: number;
  has5mData?: boolean;
  has15mData?: boolean;
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
    awesome_oscillator: {
      ao: number;
      prev_ao: number;
      color: string;
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
  timeframe_alignment: {
    '1m': string;
    '5m': string;
    '15m': string;
    isAligned: boolean;
    conflictDetected: boolean;
    dataAvailable: boolean;
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

export function calcAwesomeOscillator(highs: number[], lows: number[]): { ao: number; prev_ao: number; color: string } {
  if (highs.length < 35) {
    return { ao: 0, prev_ao: 0, color: 'neutral' };
  }
  const median: number[] = [];
  for (let i = 0; i < highs.length; i++) {
    median.push((highs[i] + lows[i]) / 2);
  }
  const sma5 = calcSMA(median, 5);
  const sma34 = calcSMA(median, 34);
  if (sma34.length < 2) {
    return { ao: 0, prev_ao: 0, color: 'neutral' };
  }
  const offset = median.length - sma34.length;
  const sma5Aligned = sma5.slice(sma5.length - sma34.length);

  const aoValues: number[] = [];
  for (let i = 0; i < sma34.length; i++) {
    aoValues.push(sma5Aligned[i] - sma34[i]);
  }

  const curr = aoValues[aoValues.length - 1];
  const prev = aoValues[aoValues.length - 2] ?? curr;
  const color = curr >= prev ? 'green' : 'red';
  return { ao: Math.round(curr * 100000) / 100000, prev_ao: Math.round(prev * 100000) / 100000, color };
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
  symbol = 'EUR/USD',
  interval = '1min',
  mtfContext?: MTFContext
): NativeSignalResult {
  const disclaimer =
    'This signal is for informational purposes only. Quantitative setups represent model confluence, not guaranteed financial returns.';

  if (!candles || candles.length < 15) {
    return {
      direction: 'WAIT',
      confidence: 0,
      trade_quality: 'DATA_UNAVAILABLE',
      score_breakdown: { trendScore: 0, momentumScore: 0, priceActionScore: 0, mtfScore: 0, volatilityScore: 0, totalScore: 0 },
      market_regime: 'RANGING',
      false_signal_filter: { isTriggered: true, reason: 'Insufficient candle history (<15 candles)', isSideways: true, isAbnormalVolatility: false, isFalseBreakout: false, isWickRejection: false },
      entry_timing: {
        rule_en: 'Accumulating genuine market data before calculating quantitative setup.',
        rule_hi: 'Paryapt genuine candle data aane tak wait karein.',
        recommended_action: 'Wait for live feed',
        entry_window: 'None',
        expiry_duration: '1min',
        confluence_count: 0,
        quality_tier: 'WAIT',
        quality_label: 'Awaiting market feed accumulation',
        matched_frameworks: ['Data Accumulation'],
      },
      confluence_score: 0,
      next_probable_setup: { bias: 'CALL', biasPercentage: 50, bullishPower: 50, bearishPower: 50, watchTrigger: 'Awaiting candle accumulation', setupSummary: 'Insufficient market data' },
      indicators: {} as any,
      reasons: { bullish: [], bearish: [], wait_reasons: ['Insufficient genuine candle history (<15 candles)'] },
      patterns: [],
      timeframe_alignment: {
        '1m': 'WAIT',
        '5m': 'UNAVAILABLE',
        '15m': 'UNAVAILABLE',
        isAligned: false,
        conflictDetected: false,
        dataAvailable: false,
      },
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
  const aoData = calcAwesomeOscillator(highs, lows);
  const atrData = calcATR(highs, lows, closes, 14);
  const stochRsiData = calcStochasticRSI(closes, 14, 14, 3, 3);
  const vwapValue = calcVWAP(candles);
  const srData = calcSupportResistance(candles);
  const patterns = detectCandlePatterns(candles);

  // 2. Market Regime & False Signal Detection
  const bbWidthPct = bbData.width / Math.max(bbData.middle, 1);
  let marketRegime: MarketRegime = 'TRENDING';
  if (adxData.adx < 20 || bbWidthPct < 0.0015) {
    marketRegime = 'RANGING';
  } else if (atrData.current > atrData.average * 2.2) {
    marketRegime = 'VOLATILE';
  }

  const isSideways = marketRegime === 'RANGING';
  const isAbnormalVolatility = atrData.current > atrData.average * 2.5;

  // Wick rejection check
  const lastRange = lastCandle.high - lastCandle.low || 0.0001;
  const lastBody = Math.abs(lastCandle.close - lastCandle.open);
  const lastUpperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const lastLowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;

  const isCallWickRejection = lastUpperWick >= 0.35 * lastRange || (lastBody > 0 && lastUpperWick >= 0.85 * lastBody);
  const isPutWickRejection = lastLowerWick >= 0.35 * lastRange || (lastBody > 0 && lastLowerWick >= 0.85 * lastBody);
  const isWickRejection = isCallWickRejection || isPutWickRejection;

  const isFalseBreakout =
    (srData.position === 'at_resistance' && lastUpperWick > lastRange * 0.45 && lastCandle.close < (srData.nearestResistance || currentPrice)) ||
    (srData.position === 'at_support' && lastLowerWick > lastRange * 0.45 && lastCandle.close > (srData.nearestSupport || currentPrice));

  // 3. Quantitative 100-Point Scoring Engine (Genuine Non-Double-Counted Components)
  let bullTrend = 0;
  let bearTrend = 0;

  // Trend (25 pts):
  if (ema9 > ema21) {
    bullTrend += ema21 > ema50 ? 12 : 8;
  } else if (ema9 < ema21) {
    bearTrend += ema21 < ema50 ? 12 : 8;
  }
  if (currentPrice > sma50) bullTrend += 3;
  else bearTrend += 3;
  if (currentPrice > sma200) bullTrend += 3;
  else bearTrend += 3;
  if (adxData.plus_di > adxData.minus_di) bullTrend += 4;
  else if (adxData.minus_di > adxData.plus_di) bearTrend += 4;
  if (macdData.macd > 0) bullTrend += 3;
  else bearTrend += 3;

  // Momentum (20 pts):
  let bullMom = 0;
  let bearMom = 0;
  if (rsi >= 50 && rsi <= 68) bullMom += 7;
  else if (rsi > 68 && rsi <= 75) bullMom += 4;
  else if (rsi <= 50 && rsi >= 32) bearMom += 7;
  else if (rsi < 32 && rsi >= 25) bearMom += 4;

  if (macdData.histogram > 0) bullMom += 5;
  else if (macdData.histogram < 0) bearMom += 5;

  if (stochRsiData.signal === 'oversold_bullish' || stochRsiData.signal === 'bullish_momentum') bullMom += 4;
  else if (stochRsiData.signal === 'overbought_bearish' || stochRsiData.signal === 'bearish_momentum') bearMom += 4;

  if (aoData.ao > 0 && aoData.color === 'green') bullMom += 4;
  else if (aoData.ao < 0 && aoData.color === 'red') bearMom += 4;

  // Price Action (20 pts):
  let bullPA = 0;
  let bearPA = 0;
  const prevCandle = candles[candles.length - 2];
  if (lastCandle.high > prevCandle.high && lastCandle.low > prevCandle.low) bullPA += 8;
  else if (lastCandle.high < prevCandle.high && lastCandle.low < prevCandle.low) bearPA += 8;

  const bullPattern = patterns.find((p) => p.type === 'bullish');
  const bearPattern = patterns.find((p) => p.type === 'bearish');
  if (bullPattern) bullPA += Math.round(bullPattern.strength * 7);
  if (bearPattern) bearPA += Math.round(bearPattern.strength * 7);

  if (srData.position === 'at_support' && lastCandle.close > lastCandle.open) bullPA += 5;
  else if (srData.position === 'at_resistance' && lastCandle.close < lastCandle.open) bearPA += 5;
  else if (srData.position === 'mid_range') {
    bullPA += 2;
    bearPA += 2;
  }

  // Phase 2: Genuine Multi-Timeframe Confirmation (20 pts)
  // Requirement: NEVER invent confirmation if higher timeframe data is missing.
  let bullMtf = 0;
  let bearMtf = 0;
  let conflictDetected = false;
  let mtfDataAvailable = false;

  const s5m = mtfContext?.s5mDirection;
  const s15m = mtfContext?.s15mDirection;

  if (s5m && s5m !== 'WAIT') {
    mtfDataAvailable = true;
    if (s5m === 'CALL') bullMtf += 10;
    else if (s5m === 'PUT') bearMtf += 10;
  }

  if (s15m && s15m !== 'WAIT') {
    mtfDataAvailable = true;
    if (s15m === 'CALL') bullMtf += 10;
    else if (s15m === 'PUT') bearMtf += 10;
  }

  // Detect genuine conflicts between timeframes
  if (s5m && s15m && s5m !== 'WAIT' && s15m !== 'WAIT') {
    if (s5m !== s15m) {
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

  // Phase 4: Stricter Signal Quality & Anti-Loss Protection
  let direction: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
  let trade_quality = 'AWAITING_QUALIFIED_SETUP';
  const waitReasons: string[] = [];
  const bullReasons: string[] = [];
  const bearReasons: string[] = [];
  const matchedFrameworks: string[] = [];

  if (ema9 > ema21) bullReasons.push(`EMA 9 (${ema9.toFixed(4)}) > EMA 21 (${ema21.toFixed(4)}) Bullish Trend Alignment`);
  else bearReasons.push(`EMA 9 (${ema9.toFixed(4)}) < EMA 21 (${ema21.toFixed(4)}) Bearish Trend Alignment`);

  if (rsi >= 50) bullReasons.push(`RSI(14) at ${rsi.toFixed(1)} confirms positive upward momentum`);
  else bearReasons.push(`RSI(14) at ${rsi.toFixed(1)} confirms downward selling momentum`);

  if (adxData.adx >= 20) {
    matchedFrameworks.push(`ADX (14) Trend Strength: ${adxData.adx} (${adxData.trend_strength})`);
  }

  // Count genuine independent confirmations (out of 10)
  let bullConfirmations = 0;
  let bearConfirmations = 0;
  if (ema9 > ema21 && ema21 > ema50) bullConfirmations++;
  if (ema9 < ema21 && ema21 < ema50) bearConfirmations++;
  if (currentPrice > sma200) bullConfirmations++;
  if (currentPrice < sma200) bearConfirmations++;
  if (rsi >= 50 && rsi <= 68) bullConfirmations++;
  if (rsi <= 50 && rsi >= 32) bearConfirmations++;
  if (macdData.histogram > 0) bullConfirmations++;
  if (macdData.histogram < 0) bearConfirmations++;
  if (aoData.ao > 0 && aoData.color === 'green') bullConfirmations++;
  if (aoData.ao < 0 && aoData.color === 'red') bearConfirmations++;
  if (adxData.plus_di > adxData.minus_di && adxData.adx >= 20) bullConfirmations++;
  if (adxData.minus_di > adxData.plus_di && adxData.adx >= 20) bearConfirmations++;
  if (s5m === 'CALL') bullConfirmations++;
  if (s5m === 'PUT') bearConfirmations++;
  if (s15m === 'CALL') bullConfirmations++;
  if (s15m === 'PUT') bearConfirmations++;
  if (bullPattern) bullConfirmations++;
  if (bearPattern) bearConfirmations++;

  // Consecutive Run Exhaustion (4+ consecutive candles)
  let consecutiveSame = 0;
  let runColor: 'GREEN' | 'RED' | null = null;
  for (let i = candles.length - 1; i >= Math.max(0, candles.length - 6); i--) {
    const c = candles[i];
    const color = c.close > c.open ? 'GREEN' : c.close < c.open ? 'RED' : null;
    if (!color) break;
    if (!runColor) {
      runColor = color;
      consecutiveSame = 1;
    } else if (runColor === color) {
      consecutiveSame++;
    } else {
      break;
    }
  }

  // Anti-Loss Filters (Strict Veto to WAIT)
  let filterTriggered = false;
  let filterReason: string | null = null;
  const lastBodyRatio = lastBody / Math.max(lastRange, 0.0001);
  const bbPctB = bbData.percent_b;

  // 1. Timeframe Conflict (Phase 2 Rule)
  if (conflictDetected) {
    filterTriggered = true;
    filterReason = `Conflicting Multi-Timeframe Alignment (5M: ${s5m} vs 15M: ${s15m}) — WAIT`;
    waitReasons.push(filterReason);
  } else if (s5m && s5m !== 'WAIT' && s5m !== dominantBias) {
    filterTriggered = true;
    filterReason = `Timeframe Conflict: 1M setup (${dominantBias}) opposes 5M trend (${s5m}) — WAIT`;
    waitReasons.push(filterReason);
  } else if (s15m && s15m !== 'WAIT' && s15m !== dominantBias) {
    filterTriggered = true;
    filterReason = `Macro Timeframe Conflict: Setup opposes 15M major trend (${s15m}) — Counter-trend trade blocked`;
    waitReasons.push(filterReason);
  }
  // 2. Sideways Market Chop
  else if (isSideways) {
    filterTriggered = true;
    filterReason = `Sideways Market Chop (ADX: ${adxData.adx.toFixed(1)} < 20) — Avoid chop losses`;
    waitReasons.push(filterReason);
  }
  // 3. Abnormal Volatility Spike
  else if (isAbnormalVolatility) {
    filterTriggered = true;
    filterReason = `Abnormal Volatility Spike (${(atrData.current / atrData.average).toFixed(1)}x ATR) — High Risk`;
    waitReasons.push(filterReason);
  }
  // 4. False Breakout
  else if (isFalseBreakout) {
    filterTriggered = true;
    filterReason = `False Breakout Wick Rejection at Key Level`;
    waitReasons.push(filterReason);
  }
  // 5. Bollinger Band Traps
  else if (dominantBias === 'CALL' && (currentPrice >= bbData.upper * 0.9995 || (bbPctB !== undefined && bbPctB >= 0.95))) {
    filterTriggered = true;
    filterReason = `Bollinger Upper Band Overbought Exhaustion (%B >= 0.95) — Reversal trap risk high`;
    waitReasons.push(filterReason);
  } else if (dominantBias === 'PUT' && (currentPrice <= bbData.lower * 1.0005 || (bbPctB !== undefined && bbPctB <= 0.05))) {
    filterTriggered = true;
    filterReason = `Bollinger Lower Band Oversold Exhaustion (%B <= 0.05) — Bounce trap risk high`;
    waitReasons.push(filterReason);
  }
  // 6. RSI Momentum Exhaustion
  else if (dominantBias === 'CALL' && rsi > 68) {
    filterTriggered = true;
    filterReason = `RSI Overbought Exhaustion (${rsi.toFixed(1)} > 68) — Pullback risk high`;
    waitReasons.push(filterReason);
  } else if (dominantBias === 'PUT' && rsi < 32) {
    filterTriggered = true;
    filterReason = `RSI Oversold Exhaustion (${rsi.toFixed(1)} < 32) — Bounce risk high`;
    waitReasons.push(filterReason);
  }
  // 7. Indecisive Candle Body / Doji
  else if (lastBodyRatio < 0.40) {
    filterTriggered = true;
    filterReason = `Indecisive Candle Body (Body ${(lastBodyRatio * 100).toFixed(0)}% < 40% of Range) — High directional uncertainty`;
    waitReasons.push(filterReason);
  }
  // 8. Rejection Wick Filter
  else if (dominantBias === 'CALL' && isCallWickRejection) {
    filterTriggered = true;
    filterReason = `Selling Pressure Wick Rejection: Upper Wick (${((lastUpperWick / lastRange) * 100).toFixed(0)}%) contradicts CALL`;
    waitReasons.push(filterReason);
  } else if (dominantBias === 'PUT' && isPutWickRejection) {
    filterTriggered = true;
    filterReason = `Buying Pressure Wick Rejection: Lower Wick (${((lastLowerWick / lastRange) * 100).toFixed(0)}%) contradicts PUT`;
    waitReasons.push(filterReason);
  }
  // 9. Anti-Trend Filter
  else if (dominantBias === 'CALL' && ema9 < ema21 && currentPrice < ema50) {
    filterTriggered = true;
    filterReason = `Anti-Trend Filter: Cannot CALL in prevailing downtrend (EMA 9 < 21 & Price < EMA 50)`;
    waitReasons.push(filterReason);
  } else if (dominantBias === 'PUT' && ema9 > ema21 && currentPrice > ema50) {
    filterTriggered = true;
    filterReason = `Anti-Trend Filter: Cannot PUT in prevailing uptrend (EMA 9 > 21 & Price > EMA 50)`;
    waitReasons.push(filterReason);
  }
  // 10. Macro Trend Veto (Price vs SMA 200)
  else if (dominantBias === 'CALL' && currentPrice < sma200) {
    filterTriggered = true;
    filterReason = `Macro Trend Veto: Price < SMA 200 — Counter-trend CALL blocked`;
    waitReasons.push(filterReason);
  } else if (dominantBias === 'PUT' && currentPrice > sma200) {
    filterTriggered = true;
    filterReason = `Macro Trend Veto: Price > SMA 200 — Counter-trend PUT blocked`;
    waitReasons.push(filterReason);
  }
  // 11. Consecutive Run Exhaustion
  else if (consecutiveSame >= 4 && runColor === 'GREEN' && dominantBias === 'CALL') {
    filterTriggered = true;
    filterReason = `Candle Exhaustion: ${consecutiveSame} consecutive green candles. Retracement risk high. WAIT.`;
    waitReasons.push(filterReason);
  } else if (consecutiveSame >= 4 && runColor === 'RED' && dominantBias === 'PUT') {
    filterTriggered = true;
    filterReason = `Candle Exhaustion: ${consecutiveSame} consecutive red candles. Bounce risk high. WAIT.`;
    waitReasons.push(filterReason);
  }
  // 12. Institutional Quantitative Threshold (Min 65 points AND at least 4 independent confluences)
  else if (dominantScore < 65 || (dominantBias === 'CALL' && bullConfirmations < 4) || (dominantBias === 'PUT' && bearConfirmations < 4)) {
    filterTriggered = true;
    const reqConf = dominantBias === 'CALL' ? bullConfirmations : bearConfirmations;
    filterReason = `Setup Score (${dominantScore}/100) or Confluence (${reqConf}/10) below high-accuracy threshold (Min 65 pts, 4 confluences)`;
    waitReasons.push(filterReason);
  }

  const confluenceCount = dominantBias === 'CALL' ? bullConfirmations : bearConfirmations;

  if (filterTriggered) {
    direction = 'WAIT';
    trade_quality = filterReason || 'AWAITING 65+ SCORE CONFLUENCE';
  } else if (dominantScore >= 85) {
    direction = dominantBias;
    trade_quality = `STRONG_SETUP (${dominantScore} pts, ${confluenceCount}/10 confluences)`;
    matchedFrameworks.push(`100-Point Quantitative Engine: Strong ${direction} (${dominantScore}/100)`);
  } else if (dominantScore >= 65) {
    direction = dominantBias;
    trade_quality = `QUALIFIED_SETUP (${dominantScore} pts, ${confluenceCount}/10 confluences)`;
    matchedFrameworks.push(`Quantitative Engine: ${direction} (${dominantScore}/100)`);
  }

  // Cap score in breakdown when in WAIT so it never leaks >= 65
  if (direction === 'WAIT' && scoreBreakdown.totalScore >= 65) {
    scoreBreakdown.totalScore = 63;
  }

  // Candle-Slot Locking: guarantees zero flicker during current candle
  const now = Date.now();
  const intervalSeconds = interval === '1min' ? 60 : interval === '15min' ? 900 : 300;
  const candleSlot = Math.floor(now / 1000 / intervalSeconds) * intervalSeconds;
  const latchKey = `${symbol.toUpperCase()}_${interval}`;
  const currentLatch = signalLatchMap.get(latchKey);

  const effectiveConfidence = direction === 'WAIT' ? Math.min(dominantScore, 63) : dominantScore;

  if (!filterTriggered && currentLatch && currentLatch.candleSlot === candleSlot) {
    if ((currentLatch.direction === 'CALL' || currentLatch.direction === 'PUT') && currentLatch.confidence >= 65) {
      direction = currentLatch.direction;
      trade_quality = currentLatch.trade_quality;
    }
  } else {
    signalLatchMap.set(latchKey, {
      candleSlot,
      direction,
      confidence: effectiveConfidence,
      trade_quality,
      score_breakdown: scoreBreakdown,
      reasons: { bullish: bullReasons, bearish: bearReasons, wait_reasons: waitReasons },
    });
  }

  const rawBullPower = Math.round((bullTotal / Math.max(bullTotal + bearTotal, 1)) * 100);
  const bullPowerPct = Math.min(95, Math.max(5, rawBullPower));
  const bearPowerPct = 100 - bullPowerPct;
  const biasPercentage = Math.max(bullPowerPct, bearPowerPct);

  const watchTrigger =
    dominantBias === 'CALL'
      ? `Next completed candle close above EMA 9 (${ema9.toFixed(4)}) with RSI > 50 & ADX > 20 required for confirmed CALL entry`
      : `Next completed candle close below EMA 9 (${ema9.toFixed(4)}) with RSI < 50 & ADX > 20 required for confirmed PUT entry`;

  const setupSummary =
    direction === 'WAIT'
      ? `Status: WAIT • Market developing ${dominantBias} bias (${biasPercentage}% odds). ${watchTrigger}.`
      : `${direction} verified with ${dominantScore}/100 setup score and ${confluenceCount}/10 confluences. Low trap risk.`;

  const nextProbableSetup: NextProbableSetup = {
    bias: dominantBias,
    biasPercentage,
    bullishPower: bullPowerPct,
    bearishPower: bearPowerPct,
    watchTrigger,
    setupSummary,
  };

  return {
    direction,
    confidence: effectiveConfidence,
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
      rule_en: `Execute at open of new candle (0-10s window strictly). DO NOT enter mid-candle. Fixed ${interval} expiry.`,
      rule_hi: `Nayi candle open hote hi pehle 0-10 seconds me entry lein. Candle ke beech me trade bilkul na lein varna loss hoga. Expiry: ${interval}.`,
      recommended_action: direction === 'WAIT' ? 'Wait for valid setup' : `Execute ${direction} at candle open (00:00 - 00:10)`,
      entry_window: 'Candle Open Window: 00:00 - 00:10 (Strict)',
      expiry_duration: `${interval} (Fixed)`,
      confluence_count: confluenceCount,
      quality_tier: direction !== 'WAIT' ? (dominantScore >= 85 ? 'Strong Setup (85-100 pts)' : 'Moderate Setup (65-84 pts)') : 'Awaiting 65+ Score Confluence',
      quality_label: `${direction} Setup Score: ${dominantScore}/100 (${marketRegime})`,
      matched_frameworks: matchedFrameworks,
    },
    confluence_score: effectiveConfidence,
    next_probable_setup: nextProbableSetup,
    indicators: {
      rsi: { value: Math.round(rsi * 10) / 10, signal: rsi >= 60 ? 'Bullish' : rsi <= 40 ? 'Bearish' : 'Neutral' },
      macd: {
        macd: Math.round(macdData.macd * 100000) / 100000,
        signal_line: Math.round(macdData.signal * 100000) / 100000,
        histogram: Math.round(macdData.histogram * 100000) / 100000,
        crossover: macdData.crossover,
      },
      ema: {
        ema9: Math.round(ema9 * 10000) / 10000,
        ema21: Math.round(ema21 * 10000) / 10000,
        ema50: Math.round(ema50 * 10000) / 10000,
        ema200: Math.round(ema200 * 10000) / 10000,
        trend: ema9 > ema21 ? 'BULLISH' : 'BEARISH',
      },
      sma: {
        sma50: Math.round(sma50 * 10000) / 10000,
        sma200: Math.round(sma200 * 10000) / 10000,
        trend: currentPrice > sma50 ? 'BULLISH' : 'BEARISH',
      },
      bollinger: {
        upper: Math.round(bbData.upper * 10000) / 10000,
        middle: Math.round(bbData.middle * 10000) / 10000,
        lower: Math.round(bbData.lower * 10000) / 10000,
        width: Math.round(bbData.width * 10000) / 10000,
        percent_b: Math.round(bbData.percent_b * 100) / 100,
        signal: bbData.percent_b > 0.8 ? 'Overbought' : bbData.percent_b < 0.2 ? 'Oversold' : 'Neutral',
      },
      adx: adxData,
      awesome_oscillator: aoData,
      atr: {
        value: Math.round(atrData.current * 10000) / 10000,
        isSpike: isAbnormalVolatility,
      },
      stochastic_rsi: stochRsiData,
      vwap: {
        value: vwapValue ? Math.round(vwapValue * 10000) / 10000 : null,
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
      '5m': s5m || 'UNAVAILABLE',
      '15m': s15m || 'UNAVAILABLE',
      isAligned: Boolean(s5m && s15m && s5m === s15m && s5m === dominantBias),
      conflictDetected,
      dataAvailable: mtfDataAvailable,
    },
    analysis_horizon: interval,
    timestamp: new Date().toISOString(),
    disclaimer,
  };
}
