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

  // Normalize RSI (handles both number and { value, signal } object)
  const rsiRaw = indicators.rsi;
  const rsi: number | null =
    typeof rsiRaw === 'number'
      ? rsiRaw
      : typeof rsiRaw === 'object' && rsiRaw !== null && typeof rsiRaw.value === 'number'
      ? rsiRaw.value
      : null;
  const rsiSignal = typeof rsiRaw === 'object' && rsiRaw?.signal ? rsiRaw.signal : null;

  // Normalize MACD
  const macdRaw = indicators.macd;
  const macd = macdRaw && typeof macdRaw === 'object' ? {
    macd: typeof macdRaw.macd === 'number' ? macdRaw.macd : 0,
    signal: typeof macdRaw.signal === 'number'
      ? macdRaw.signal
      : typeof macdRaw.signal_line === 'number'
      ? macdRaw.signal_line
      : 0,
    histogram: typeof macdRaw.histogram === 'number' ? macdRaw.histogram : 0,
    crossover: macdRaw.crossover || 'none',
  } : null;

  // Normalize EMAs
  const emaRaw = indicators.ema || {};
  const ema9: number | null = typeof emaRaw.ema9 === 'number' ? emaRaw.ema9 : typeof indicators.ema9 === 'number' ? indicators.ema9 : null;
  const ema21: number | null = typeof emaRaw.ema21 === 'number' ? emaRaw.ema21 : typeof indicators.ema21 === 'number' ? indicators.ema21 : null;
  const ema50: number | null = typeof emaRaw.ema50 === 'number' ? emaRaw.ema50 : null;

  // Normalize Bollinger Bands
  const bbRaw = indicators.bollinger || indicators.bollingerBands;
  const bb = bbRaw && typeof bbRaw === 'object' && typeof bbRaw.upper === 'number' ? {
    upper: bbRaw.upper,
    middle: bbRaw.middle,
    lower: bbRaw.lower,
    percentB: typeof bbRaw.percent_b === 'number' ? bbRaw.percent_b : null,
  } : null;

  // Support / Resistance
  const srRaw = indicators.support_resistance;
  const sr = srRaw && typeof srRaw === 'object' ? {
    nearestSupport: srRaw.nearest_support,
    nearestResistance: srRaw.nearest_resistance,
    position: srRaw.position,
  } : null;

  // Stochastic
  const stochRaw = indicators.stochastic;
  const stoch = stochRaw && typeof stochRaw === 'object' && typeof stochRaw.k === 'number' ? {
    k: stochRaw.k,
    d: stochRaw.d,
    signal: stochRaw.signal,
  } : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
        Technical Indicators
      </h3>

      <div className="space-y-3">
        {/* RSI */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">RSI (14)</p>
            {rsi != null ? (
              <p className={clsx('text-sm font-semibold', getRsiColor(rsi))}>
                {rsi.toFixed(2)}
              </p>
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

        {/* MACD */}
        {macd != null && (
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-400 text-xs">MACD (12, 26, 9)</p>
              {macd.crossover !== 'none' && (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase',
                  macd.crossover === 'bullish' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                )}>
                  {macd.crossover} cross
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-gray-600 text-xs">MACD</p>
                <p className={clsx('text-xs font-semibold font-mono',
                  macd.macd >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {macd.macd.toFixed(5)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Signal</p>
                <p className="text-gray-100 text-xs font-semibold font-mono">
                  {macd.signal.toFixed(5)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Histogram</p>
                <p className={clsx('text-xs font-semibold font-mono',
                  macd.histogram >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {macd.histogram.toFixed(5)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EMAs */}
        {(ema9 != null || ema21 != null || ema50 != null) && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-gray-400 text-xs mb-1.5">Moving Averages (EMA)</p>
            <div className="grid grid-cols-3 gap-2">
              {ema9 != null && (
                <div>
                  <p className="text-blue-400/70 text-xs">EMA9</p>
                  <p className="text-blue-400 text-xs font-semibold font-mono">
                    {ema9.toFixed(5)}
                  </p>
                </div>
              )}
              {ema21 != null && (
                <div>
                  <p className="text-orange-400/70 text-xs">EMA21</p>
                  <p className="text-orange-400 text-xs font-semibold font-mono">
                    {ema21.toFixed(5)}
                  </p>
                </div>
              )}
              {ema50 != null && (
                <div>
                  <p className="text-purple-400/70 text-xs">EMA50</p>
                  <p className="text-purple-400 text-xs font-semibold font-mono">
                    {ema50.toFixed(5)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bollinger Bands */}
        {bb != null && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-gray-400 text-xs mb-1.5">Bollinger Bands (20, 2)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-gray-600 text-xs">Upper</p>
                <p className="text-gray-200 text-xs font-mono">{bb.upper.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Middle</p>
                <p className="text-gray-200 text-xs font-mono">{bb.middle.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Lower</p>
                <p className="text-gray-200 text-xs font-mono">{bb.lower.toFixed(5)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Support & Resistance */}
        {sr != null && (sr.nearestSupport != null || sr.nearestResistance != null) && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-gray-400 text-xs mb-1.5">Support & Resistance</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-emerald-400/70 text-xs">Nearest Support</p>
                <p className="text-emerald-400 text-xs font-mono font-semibold">
                  {sr.nearestSupport ? sr.nearestSupport.toFixed(5) : '---'}
                </p>
              </div>
              <div>
                <p className="text-red-400/70 text-xs">Nearest Resistance</p>
                <p className="text-red-400 text-xs font-mono font-semibold">
                  {sr.nearestResistance ? sr.nearestResistance.toFixed(5) : '---'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stochastic */}
        {stoch != null && (
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-400 text-xs">Stochastic Oscillator</p>
              {stoch.signal && stoch.signal !== 'neutral' && (
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize',
                  stoch.signal === 'oversold' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                )}>
                  {stoch.signal}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-gray-600 text-xs">%K</p>
                <p className="text-gray-200 text-xs font-mono">{stoch.k.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">%D</p>
                <p className="text-gray-200 text-xs font-mono">{stoch.d.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IndicatorPanel;
