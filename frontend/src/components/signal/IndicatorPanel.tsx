import React from 'react';
import clsx from 'clsx';

interface IndicatorPanelProps {
  indicators: any;
}

function getRsiColor(rsi: number): string {
  if (rsi >= 70) return 'text-red-400';
  if (rsi <= 30) return 'text-emerald-400';
  return 'text-gray-100';
}

function getRsiLabel(rsi: number): string {
  if (rsi >= 70) return 'Overbought';
  if (rsi <= 30) return 'Oversold';
  return 'Neutral';
}

const IndicatorPanel: React.FC<IndicatorPanelProps> = ({ indicators }) => {
  if (!indicators) return null;

  // RSI (14)
  const rsiRaw = indicators.rsi;
  const rsi: number | null =
    typeof rsiRaw === 'number'
      ? rsiRaw
      : typeof rsiRaw === 'object' && rsiRaw !== null && typeof rsiRaw.value === 'number'
      ? rsiRaw.value
      : null;
  const rsiSignal = typeof rsiRaw === 'object' && rsiRaw?.signal ? rsiRaw.signal : null;

  // MACD (12, 26, 9)
  const macdRaw = indicators.macd;
  const macd =
    macdRaw && typeof macdRaw === 'object'
      ? {
          macd: typeof macdRaw.macd === 'number' ? macdRaw.macd : 0,
          signal:
            typeof macdRaw.signal === 'number'
              ? macdRaw.signal
              : typeof macdRaw.signal_line === 'number'
              ? macdRaw.signal_line
              : 0,
          histogram: typeof macdRaw.histogram === 'number' ? macdRaw.histogram : 0,
          crossover: macdRaw.crossover || 'neutral',
        }
      : null;

  // EMAs (9, 21, 50, 200)
  const emaRaw = indicators.ema || {};
  const ema9: number | null = typeof emaRaw.ema9 === 'number' ? emaRaw.ema9 : null;
  const ema21: number | null = typeof emaRaw.ema21 === 'number' ? emaRaw.ema21 : null;
  const ema50: number | null = typeof emaRaw.ema50 === 'number' ? emaRaw.ema50 : null;
  const ema200: number | null = typeof emaRaw.ema200 === 'number' ? emaRaw.ema200 : null;

  // SMAs (50, 200)
  const smaRaw = indicators.sma || {};
  const sma50: number | null = typeof smaRaw.sma50 === 'number' ? smaRaw.sma50 : null;
  const sma200: number | null = typeof smaRaw.sma200 === 'number' ? smaRaw.sma200 : null;

  // Bollinger Bands (20, 2)
  const bbRaw = indicators.bollinger;
  const bb =
    bbRaw && typeof bbRaw === 'object' && typeof bbRaw.upper === 'number'
      ? {
          upper: bbRaw.upper,
          middle: bbRaw.middle,
          lower: bbRaw.lower,
          percentB: typeof bbRaw.percent_b === 'number' ? bbRaw.percent_b : null,
        }
      : null;

  // ADX (14)
  const adxRaw = indicators.adx;
  const adx =
    adxRaw && typeof adxRaw === 'object' && typeof adxRaw.adx === 'number'
      ? {
          adx: adxRaw.adx,
          plusDi: adxRaw.plus_di ?? 20,
          minusDi: adxRaw.minus_di ?? 20,
          trendStrength: adxRaw.trend_strength || 'Normal',
        }
      : null;

  // ATR (14)
  const atrRaw = indicators.atr;
  const atr =
    atrRaw && typeof atrRaw === 'object' && typeof atrRaw.value === 'number'
      ? {
          value: atrRaw.value,
          isSpike: atrRaw.isSpike,
        }
      : null;

  // Stochastic RSI
  const stochRsiRaw = indicators.stochastic_rsi || indicators.stochastic;
  const stochRsi =
    stochRsiRaw && typeof stochRsiRaw === 'object' && typeof stochRsiRaw.k === 'number'
      ? {
          k: stochRsiRaw.k,
          d: stochRsiRaw.d,
          signal: stochRsiRaw.signal,
        }
      : null;

  // VWAP
  const vwapRaw = indicators.vwap;
  const vwap =
    vwapRaw && typeof vwapRaw === 'object' && typeof vwapRaw.value === 'number'
      ? {
          value: vwapRaw.value,
          position: vwapRaw.position || 'N/A',
        }
      : null;

  // Support / Resistance
  const srRaw = indicators.support_resistance;
  const sr =
    srRaw && typeof srRaw === 'object'
      ? {
          nearestSupport: srRaw.nearest_support,
          nearestResistance: srRaw.nearest_resistance,
          position: srRaw.position,
        }
      : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center justify-between">
        <span>Quantitative Indicators</span>
        <span className="text-[10px] text-gray-500 font-mono">11 Models Computed</span>
      </h3>

      <div className="space-y-3">
        {/* RSI (14) */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">RSI (14)</p>
            {rsi != null ? (
              <p className={clsx('text-sm font-semibold', getRsiColor(rsi))}>{rsi.toFixed(2)}</p>
            ) : (
              <p className="text-gray-600 text-sm font-mono">---</p>
            )}
          </div>
          {rsi != null && (
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded-full capitalize',
                rsi >= 70
                  ? 'bg-red-900/40 text-red-400'
                  : rsi <= 30
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-gray-800 text-gray-400'
              )}
            >
              {rsiSignal || getRsiLabel(rsi)}
            </span>
          )}
        </div>

        {/* RSI bar */}
        {rsi != null && (
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                rsi >= 70 ? 'bg-red-500' : rsi <= 30 ? 'bg-emerald-500' : 'bg-blue-500'
              )}
              style={{ width: `${Math.min(Math.max(rsi, 0), 100)}%` }}
            />
          </div>
        )}

        {/* MACD (12, 26, 9) */}
        {macd != null && (
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-400 text-xs">MACD (12, 26, 9)</p>
              {macd.crossover !== 'neutral' && (
                <span
                  className={clsx(
                    'text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase',
                    macd.crossover.includes('bullish') ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                  )}
                >
                  {macd.crossover.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-gray-600 text-xs">MACD</p>
                <p className={clsx('text-xs font-semibold font-mono', macd.macd >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {macd.macd.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Signal</p>
                <p className="text-gray-100 text-xs font-semibold font-mono">{macd.signal.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Histogram</p>
                <p className={clsx('text-xs font-semibold font-mono', macd.histogram >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {macd.histogram.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EMAs & SMAs */}
        {(ema9 != null || ema21 != null || ema50 != null || sma200 != null) && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-gray-400 text-xs mb-1.5">Moving Averages (EMA 9, 21, 50, 200 &amp; SMA 50, 200)</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              {ema9 != null && (
                <div>
                  <p className="text-blue-400/70 text-[10px]">EMA9</p>
                  <p className="text-blue-400 font-semibold">{ema9.toFixed(2)}</p>
                </div>
              )}
              {ema21 != null && (
                <div>
                  <p className="text-orange-400/70 text-[10px]">EMA21</p>
                  <p className="text-orange-400 font-semibold">{ema21.toFixed(2)}</p>
                </div>
              )}
              {ema50 != null && (
                <div>
                  <p className="text-purple-400/70 text-[10px]">EMA50</p>
                  <p className="text-purple-400 font-semibold">{ema50.toFixed(2)}</p>
                </div>
              )}
              {sma200 != null && (
                <div>
                  <p className="text-yellow-400/70 text-[10px]">SMA200</p>
                  <p className="text-yellow-400 font-semibold">{sma200.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADX (14) & ATR (14) */}
        {(adx != null || atr != null) && (
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-400 text-xs">ADX (14) &amp; ATR (14)</p>
              {adx && (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded font-mono',
                  adx.adx >= 25 ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300' : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
                )}>
                  ADX: {adx.adx} ({adx.trendStrength})
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              {adx && (
                <>
                  <div>
                    <p className="text-emerald-500/70 text-[10px]">+DI</p>
                    <p className="text-emerald-400 font-semibold">{adx.plusDi}</p>
                  </div>
                  <div>
                    <p className="text-red-500/70 text-[10px]">-DI</p>
                    <p className="text-red-400 font-semibold">{adx.minusDi}</p>
                  </div>
                </>
              )}
              {atr && (
                <div>
                  <p className="text-gray-500 text-[10px]">ATR Volatility</p>
                  <p className={clsx('font-semibold', atr.isSpike ? 'text-red-400' : 'text-gray-200')}>
                    {atr.value.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bollinger Bands (20, 2) */}
        {bb != null && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-gray-400 text-xs mb-1.5">Bollinger Bands (20, 2)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-gray-600 text-xs">Upper</p>
                <p className="text-gray-200 text-xs font-mono">{bb.upper.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Middle</p>
                <p className="text-gray-200 text-xs font-mono">{bb.middle.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Lower</p>
                <p className="text-gray-200 text-xs font-mono">{bb.lower.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stochastic RSI & VWAP */}
        {(stochRsi != null || vwap != null) && (
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-400 text-xs">Stochastic RSI &amp; VWAP</p>
              {vwap?.value && (
                <span className="text-[10px] text-gray-400 font-mono">
                  VWAP: {vwap.value.toFixed(2)} ({vwap.position})
                </span>
              )}
            </div>
            {stochRsi && (
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <p className="text-gray-600 text-xs">Stoch RSI %K</p>
                  <p className="text-gray-200 font-semibold">{stochRsi.k.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs">Stoch RSI %D</p>
                  <p className="text-gray-200 font-semibold">{stochRsi.d.toFixed(1)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Support & Resistance */}
        {sr != null && (sr.nearestSupport != null || sr.nearestResistance != null) && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-gray-400 text-xs mb-1.5">Support &amp; Resistance Levels</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-emerald-400/70 text-xs">Nearest Support</p>
                <p className="text-emerald-400 text-xs font-mono font-semibold">
                  {sr.nearestSupport ? sr.nearestSupport.toFixed(2) : '---'}
                </p>
              </div>
              <div>
                <p className="text-red-400/70 text-xs">Nearest Resistance</p>
                <p className="text-red-400 text-xs font-mono font-semibold">
                  {sr.nearestResistance ? sr.nearestResistance.toFixed(2) : '---'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndicatorPanel;
