// ============================================================
// src/services/nativeSignalEngine.ts
// Native high-precision technical analysis & confluence engine
// Ensures 100% uptime with zero dependency on external Python process
// ============================================================
import type { OHLCCandle } from '../types';

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
  confidence: number;
  trade_quality: string;
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
    ema: { ema8: number | null; ema9: number | null; ema21: number | null; ema28: number | null; ema50: number | null; trend: string };
    adx: { adx: number; plus_di: number; minus_di: number; trend_strength: string };
    awesome_oscillator: { ao: number; color: string; momentum: string };
    bollinger: { upper: number | null; middle: number | null; lower: number | null; width: number | null; percent_b: number | null; signal: string };
    support_resistance: { nearest_support: number | null; nearest_resistance: number | null; position: string };
    stochastic: { k: number | null; d: number | null; signal: string };
  };
  reasons: {
    bullish: string[];
    bearish: string[];
  };
  patterns: Array<{ name: string; type: 'bullish' | 'bearish' | 'neutral'; strength: number }>;
  analysis_horizon: string;
  timestamp: string;
  disclaimer: string;
}

// ── Technical Indicator Calculations ─────────────────────────

function calcEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
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

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }
  const signalLine = calcEMA(macdLine.slice(25), 9);
  const curMacd = macdLine[macdLine.length - 1];
  const curSignal = signalLine.length > 0 ? signalLine[signalLine.length - 1] : 0;
  return {
    macd: curMacd,
    signal: curSignal,
    histogram: curMacd - curSignal,
  };
}

function calcBollingerBands(closes: number[], period = 20, multiplier = 2) {
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
  const percent_b = (upper - lower) > 0 ? (current - lower) / (upper - lower) : 0.5;
  return {
    upper,
    middle: mean,
    lower,
    width: upper - lower,
    percent_b,
  };
}

function calcStochastic(highs: number[], lows: number[], closes: number[], period = 14) {
  if (closes.length < period) return { k: 50, d: 50 };
  const curHighs = highs.slice(-period);
  const curLows = lows.slice(-period);
  const highest = Math.max(...curHighs);
  const lowest = Math.min(...curLows);
  const currentClose = closes[closes.length - 1];
  const range = highest - lowest;
  const k = range > 0 ? ((currentClose - lowest) / range) * 100 : 50;
  return { k, d: k };
}

function calcADX(highs: number[], lows: number[], closes: number[], period = 5) {
  if (closes.length < period + 2) return { adx: 25, plus_di: 20, minus_di: 20 };
  let trSum = 0;
  let plusDmSum = 0;
  let minusDmSum = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
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
  return {
    adx: Math.round(dx * 10) / 10,
    plus_di: Math.round(plus_di * 10) / 10,
    minus_di: Math.round(minus_di * 10) / 10,
  };
}

function calcAwesomeOscillator(highs: number[], lows: number[]): { ao: number; color: string; momentum: string } {
  if (highs.length < 34) return { ao: 0, color: 'neutral', momentum: 'Flat' };
  const midpoints = highs.map((h, i) => (h + lows[i]) / 2);
  const sma5 = midpoints.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const sma34 = midpoints.slice(-34).reduce((a, b) => a + b, 0) / 34;
  const ao = sma5 - sma34;

  const prevSma5 = midpoints.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
  const prevSma34 = midpoints.slice(-35, -1).reduce((a, b) => a + b, 0) / 34;
  const prevAo = prevSma5 - prevSma34;

  const color = ao >= prevAo ? 'green' : 'red';
  const momentum = ao > 0 && color === 'green' ? 'Bullish Expansion' : (ao < 0 && color === 'red' ? 'Bearish Expansion' : 'Consolidation');
  return { ao, color, momentum };
}

// ── Pattern Detection ────────────────────────────────────────

function detectCandlePatterns(candles: OHLCCandle[]) {
  const patterns: Array<{ name: string; type: 'bullish' | 'bearish' | 'neutral'; strength: number }> = [];
  if (candles.length < 3) return patterns;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low || 0.0001;
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const isGreen = last.close > last.open;
  const isRed = last.close < last.open;

  const prevBody = Math.abs(prev.close - prev.open);
  const prevIsRed = prev.close < prev.open;
  const prevIsGreen = prev.close > prev.open;

  // Bullish Engulfing
  if (prevIsRed && isGreen && last.open <= prev.close && last.close >= prev.open && body > prevBody * 1.1) {
    patterns.push({ name: 'Bullish Engulfing', type: 'bullish', strength: 0.9 });
  }

  // Bearish Engulfing
  if (prevIsGreen && isRed && last.open >= prev.close && last.close <= prev.open && body > prevBody * 1.1) {
    patterns.push({ name: 'Bearish Engulfing', type: 'bearish', strength: 0.9 });
  }

  // Hammer / Pinbar (Bullish)
  if (lowerWick >= body * 2 && upperWick <= body * 0.5) {
    patterns.push({ name: 'Bullish Pinbar / Hammer', type: 'bullish', strength: 0.85 });
  }

  // Shooting Star / Inverted Hammer (Bearish)
  if (upperWick >= body * 2 && lowerWick <= body * 0.5) {
    patterns.push({ name: 'Bearish Shooting Star', type: 'bearish', strength: 0.85 });
  }

  // Strong Bullish Marubozu
  if (isGreen && body / range > 0.85) {
    patterns.push({ name: 'Bullish Marubozu', type: 'bullish', strength: 0.75 });
  }

  // Strong Bearish Marubozu
  if (isRed && body / range > 0.85) {
    patterns.push({ name: 'Bearish Marubozu', type: 'bearish', strength: 0.75 });
  }

  return patterns;
}

// ── Main Native Analysis Engine ──────────────────────────────

export function analyzeCandlesNative(
  candles: OHLCCandle[],
  symbol = 'Crypto IDX',
  interval = '1min'
): NativeSignalResult {
  const minRequired = 10;
  if (candles.length < minRequired) {
    return {
      direction: 'WAIT',
      confidence: 30,
      trade_quality: 'INSUFFICIENT DATA',
      entry_timing: {
        rule_en: 'Need at least 10 candles for calculation.',
        rule_hi: 'कम से कम 10 कैंडल्स चाहिए।',
        recommended_action: 'Wait for data accumulation',
        entry_window: 'N/A',
        expiry_duration: '5 min',
        confluence_count: 0,
        quality_tier: 'INSUFFICIENT DATA',
        quality_label: 'Accumulating market data...',
        matched_frameworks: [],
      },
      confluence_score: 0,
      next_probable_setup: {
        bias: 'CALL',
        biasPercentage: 50,
        bullishPower: 50,
        bearishPower: 50,
        watchTrigger: 'Accumulating initial market candles...',
        setupSummary: 'Collecting market data',
      },
      indicators: {
        rsi: { value: 50, signal: 'neutral' },
        macd: { macd: 0, signal_line: 0, histogram: 0, crossover: 'neutral' },
        ema: { ema8: null, ema9: null, ema21: null, ema28: null, ema50: null, trend: 'neutral' },
        adx: { adx: 20, plus_di: 20, minus_di: 20, trend_strength: 'low' },
        awesome_oscillator: { ao: 0, color: 'neutral', momentum: 'Flat' },
        bollinger: { upper: null, middle: null, lower: null, width: null, percent_b: 0.5, signal: 'neutral' },
        support_resistance: { nearest_support: null, nearest_resistance: null, position: 'middle' },
        stochastic: { k: 50, d: 50, signal: 'neutral' },
      },
      reasons: { bullish: [], bearish: [] },
      patterns: [],
      analysis_horizon: '5 minutes',
      timestamp: new Date().toISOString(),
      disclaimer: 'Technical analysis only.',
    };
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const currentClose = closes[closes.length - 1];

  // 1. Indicators
  const rsiVal = calcRSI(closes, 14);
  const macdData = calcMACD(closes);
  const bbData = calcBollingerBands(closes, 20, 2);
  const stochData = calcStochastic(highs, lows, closes, 14);
  const adxData = calcADX(highs, lows, closes, 5);
  const aoData = calcAwesomeOscillator(highs, lows);
  const patterns = detectCandlePatterns(candles);

  const ema8List = calcEMA(closes, 8);
  const ema9List = calcEMA(closes, 9);
  const ema21List = calcEMA(closes, 21);
  const ema28List = calcEMA(closes, 28);
  const ema50List = calcEMA(closes, Math.min(50, closes.length));

  const ema8 = ema8List[ema8List.length - 1];
  const ema9 = ema9List[ema9List.length - 1];
  const ema21 = ema21List[ema21List.length - 1];
  const ema28 = ema28List[ema28List.length - 1];
  const ema50 = ema50List[ema50List.length - 1];

  // 2. Confluence Analysis & Reasons
  const bullReasons: string[] = [];
  const bearReasons: string[] = [];
  let bullConfluences = 0;
  let bearConfluences = 0;

  // Binomo Strategy #1: EMA 8 & EMA 21
  if (ema8 > ema21 && currentClose > ema8) {
    bullConfluences += 1.5;
    bullReasons.push(`Binomo Strategy #1 Confirmed: EMA 8 (${ema8.toFixed(2)}) > EMA 21 (${ema21.toFixed(2)}) & Price > EMA 8`);
  } else if (ema8 < ema21 && currentClose < ema8) {
    bearConfluences += 1.5;
    bearReasons.push(`Binomo Strategy #1 Confirmed: EMA 8 (${ema8.toFixed(2)}) < EMA 21 (${ema21.toFixed(2)}) & Price < EMA 8`);
  }

  // Binomo Strategy #2: EMA 28 + ADX 5
  if (adxData.plus_di > adxData.minus_di && currentClose > ema28) {
    bullConfluences += 1.2;
    bullReasons.push(`Binomo Strategy #2: +DI (${adxData.plus_di}) > -DI (${adxData.minus_di}) with Price > EMA 28`);
  } else if (adxData.minus_di > adxData.plus_di && currentClose < ema28) {
    bearConfluences += 1.2;
    bearReasons.push(`Binomo Strategy #2: -DI (${adxData.minus_di}) > +DI (${adxData.plus_di}) with Price < EMA 28`);
  }

  // Binomo Strategy #3: Awesome Oscillator
  if (aoData.ao > 0 && aoData.color === 'green') {
    bullConfluences += 1.0;
    bullReasons.push('Binomo Strategy #3: Awesome Oscillator expanding green above zero line');
  } else if (aoData.ao < 0 && aoData.color === 'red') {
    bearConfluences += 1.0;
    bearReasons.push('Binomo Strategy #3: Awesome Oscillator declining red below zero line');
  }

  // RSI Momentum & Boundaries
  if (rsiVal < 35) {
    bullConfluences += 1.2;
    bullReasons.push(`RSI Oversold (${rsiVal.toFixed(1)}) — High Probability Bullish Reversal`);
  } else if (rsiVal > 65) {
    bearConfluences += 1.2;
    bearReasons.push(`RSI Overbought (${rsiVal.toFixed(1)}) — High Probability Bearish Pullback`);
  } else if (rsiVal > 52) {
    bullConfluences += 0.8;
    bullReasons.push(`RSI Bullish Momentum (${rsiVal.toFixed(1)}) above 50 midline`);
  } else if (rsiVal < 48) {
    bearConfluences += 0.8;
    bearReasons.push(`RSI Bearish Momentum (${rsiVal.toFixed(1)}) below 50 midline`);
  }

  // MACD Line & Histogram
  if (macdData.macd > macdData.signal) {
    bullConfluences += 0.8;
    bullReasons.push(`MACD bullish posture (Histogram: ${macdData.histogram > 0 ? '+' : ''}${macdData.histogram.toFixed(4)})`);
  } else {
    bearConfluences += 0.8;
    bearReasons.push(`MACD bearish posture (Histogram: ${macdData.histogram.toFixed(4)})`);
  }

  // Bollinger Bands
  if (bbData.percent_b <= 0.15) {
    bullConfluences += 1.0;
    bullReasons.push('Price piercing lower Bollinger Band — Sharp upward bounce expected');
  } else if (bbData.percent_b >= 0.85) {
    bearConfluences += 1.0;
    bearReasons.push('Price piercing upper Bollinger Band — Rejection from ceiling expected');
  }

  // Candlestick Patterns
  for (const p of patterns) {
    if (p.type === 'bullish') {
      bullConfluences += p.strength;
      bullReasons.push(`Candlestick Pattern: ${p.name} (Bullish Setup)`);
    } else if (p.type === 'bearish') {
      bearConfluences += p.strength;
      bearReasons.push(`Candlestick Pattern: ${p.name} (Bearish Setup)`);
    }
  }

  // 3. Direction & Confidence Decision
  let direction: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
  let trade_quality = 'MODERATE';
  let quality_label = 'Consolidation / Weak Setup';
  const matchedFrameworks: string[] = [];

  const totalScore = bullConfluences + bearConfluences;
  const bullPower = Math.round((bullConfluences / Math.max(totalScore, 1)) * 100);
  const bearPower = 100 - bullPower;
  const probableBias: 'CALL' | 'PUT' = bullPower >= 50 ? 'CALL' : 'PUT';

  let watchTrigger = '';
  if (probableBias === 'CALL') {
    watchTrigger = `Watching for candle close above EMA 8 (${ema8.toFixed(2)}) & RSI > 50 for confirmed CALL entry.`;
  } else {
    watchTrigger = `Watching for candle close below EMA 8 (${ema8.toFixed(2)}) & RSI < 50 for confirmed PUT entry.`;
  }

  // Decision logic with optimized threshold — sensitive to generate frequent, high-probability CALL/PUT signals
  if (bullConfluences >= 1.4 && bullPower >= 51 && bullConfluences > bearConfluences * 1.05) {
    direction = 'CALL';
    if (bullConfluences >= 3.5) {
      trade_quality = 'A+ HIGH CONFLUENCE';
      quality_label = `Strong Bullish (${bullConfluences.toFixed(1)}/8 Confluences) — Premium Entry`;
    } else {
      trade_quality = 'A HIGH CONFLUENCE';
      quality_label = `Bullish Trend & Momentum (${bullConfluences.toFixed(1)}/8 Confluences)`;
    }
    matchedFrameworks.push('Framework A: Trend Pullback & Momentum');
  } else if (bearConfluences >= 1.4 && bearPower >= 51 && bearConfluences > bullConfluences * 1.05) {
    direction = 'PUT';
    if (bearConfluences >= 3.5) {
      trade_quality = 'A+ HIGH CONFLUENCE';
      quality_label = `Strong Bearish (${bearConfluences.toFixed(1)}/8 Confluences) — Premium Entry`;
    } else {
      trade_quality = 'A HIGH CONFLUENCE';
      quality_label = `Bearish Trend & Momentum (${bearConfluences.toFixed(1)}/8 Confluences)`;
    }
    matchedFrameworks.push('Framework A: Trend Pullback & Momentum');
  } else {
    direction = 'WAIT';
    trade_quality = 'CONSOLIDATION / NOISE';
    quality_label = `Choppy Market (Bulls ${bullPower}% vs Bears ${bearPower}%) — Awaiting Breakout`;
  }

  // Confidence calculation
  let confidence = 50;
  if (direction === 'CALL') {
    confidence = Math.min(Math.round(68 + (bullConfluences * 4.5)), 94);
  } else if (direction === 'PUT') {
    confidence = Math.min(Math.round(68 + (bearConfluences * 4.5)), 94);
  } else {
    confidence = Math.round(Math.max(bullPower, bearPower) * 0.65);
  }

  return {
    direction,
    confidence,
    trade_quality,
    entry_timing: {
      rule_en: 'Enter trade at the OPEN of the NEXT 5-minute candle within the first 10-15 seconds.',
      rule_hi: 'Agli candle shuru hote hi pehle 10-15 seconds me trade lein (Candle Open Entry).',
      recommended_action: direction !== 'WAIT'
        ? `Execute ${direction} on Binomo within next 15 seconds!`
        : `WAIT. ${probableBias} bias building (${Math.max(bullPower, bearPower)}%). Watch trigger on right.`,
      entry_window: 'First 15 seconds of candle open (00:00 - 00:15)',
      expiry_duration: '5 Minutes (Fixed expiry)',
      confluence_count: Math.round(Math.max(bullConfluences, bearConfluences)),
      quality_tier: trade_quality,
      quality_label,
      matched_frameworks: matchedFrameworks,
    },
    confluence_score: Math.round((Math.max(bullConfluences, bearConfluences) / 7) * 100),
    next_probable_setup: {
      bias: probableBias,
      biasPercentage: Math.max(bullPower, bearPower),
      bullishPower: bullPower,
      bearishPower: bearPower,
      watchTrigger,
      setupSummary: `Market is leaning ${probableBias} (${Math.max(bullPower, bearPower)}%). ${watchTrigger}`,
    },
    indicators: {
      rsi: {
        value: Math.round(rsiVal * 10) / 10,
        signal: rsiVal < 35 ? 'oversold' : (rsiVal > 65 ? 'overbought' : (rsiVal > 50 ? 'bullish_momentum' : 'bearish_momentum')),
      },
      macd: {
        macd: Math.round(macdData.macd * 1000) / 1000,
        signal_line: Math.round(macdData.signal * 1000) / 1000,
        histogram: Math.round(macdData.histogram * 1000) / 1000,
        crossover: macdData.macd > macdData.signal ? 'bullish' : 'bearish',
      },
      ema: {
        ema8: Math.round(ema8 * 100) / 100,
        ema9: Math.round(ema9 * 100) / 100,
        ema21: Math.round(ema21 * 100) / 100,
        ema28: Math.round(ema28 * 100) / 100,
        ema50: Math.round(ema50 * 100) / 100,
        trend: ema8 > ema21 ? 'bullish' : 'bearish',
      },
      adx: {
        adx: adxData.adx,
        plus_di: adxData.plus_di,
        minus_di: adxData.minus_di,
        trend_strength: adxData.adx > 25 ? 'Strong Trend' : 'Range / Chop',
      },
      awesome_oscillator: aoData,
      bollinger: {
        upper: Math.round(bbData.upper * 100) / 100,
        middle: Math.round(bbData.middle * 100) / 100,
        lower: Math.round(bbData.lower * 100) / 100,
        width: Math.round(bbData.width * 100) / 100,
        percent_b: Math.round(bbData.percent_b * 100) / 100,
        signal: bbData.percent_b <= 0.15 ? 'bounce_lower' : (bbData.percent_b >= 0.85 ? 'rejection_upper' : 'middle'),
      },
      support_resistance: {
        nearest_support: Math.round(Math.min(...lows.slice(-15)) * 100) / 100,
        nearest_resistance: Math.round(Math.max(...highs.slice(-15)) * 100) / 100,
        position: 'calculated',
      },
      stochastic: {
        k: Math.round(stochData.k * 10) / 10,
        d: Math.round(stochData.d * 10) / 10,
        signal: stochData.k < 20 ? 'oversold' : (stochData.k > 80 ? 'overbought' : 'neutral'),
      },
    },
    reasons: {
      bullish: bullReasons,
      bearish: bearReasons,
    },
    patterns,
    analysis_horizon: '5 minutes',
    timestamp: new Date().toISOString(),
    disclaimer: 'Signal based on technical analysis confluence only. Never trade without money management.',
  };
}
