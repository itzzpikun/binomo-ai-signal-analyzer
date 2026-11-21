import React, { useState } from 'react';
import clsx from 'clsx';

interface IndicatorConfig {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  params?: { key: string; label: string; value: number; min: number; max: number }[];
}

const INDICATORS: IndicatorConfig[] = [
  {
    id: 'rsi', name: 'RSI (Relative Strength Index)',
    description: 'Measures overbought/oversold conditions. Period 14.',
    defaultEnabled: true,
    params: [{ key: 'period', label: 'Period', value: 14, min: 5, max: 30 }],
  },
  {
    id: 'macd', name: 'MACD (12, 26, 9)',
    description: 'Trend-following momentum indicator using EMAs.',
    defaultEnabled: true,
    params: [
      { key: 'fast', label: 'Fast EMA', value: 12, min: 5, max: 20 },
      { key: 'slow', label: 'Slow EMA', value: 26, min: 15, max: 50 },
      { key: 'signal', label: 'Signal', value: 9, min: 3, max: 15 },
    ],
  },
  {
    id: 'ema', name: 'EMA (9, 21, 50)',
    description: 'Exponential Moving Averages for trend direction.',
    defaultEnabled: true,
    params: [
      { key: 'ema9',  label: 'Short EMA',  value: 9,  min: 3, max: 20 },
      { key: 'ema21', label: 'Medium EMA', value: 21, min: 10, max: 50 },
      { key: 'ema50', label: 'Long EMA',   value: 50, min: 30, max: 200 },
    ],
  },
  {
    id: 'bb', name: 'Bollinger Bands (20, 2)',
    description: 'Price envelope for volatility and mean reversion.',
    defaultEnabled: true,
    params: [
      { key: 'period', label: 'Period', value: 20, min: 10, max: 50 },
      { key: 'stddev', label: 'Std Dev', value: 2, min: 1, max: 4 },
    ],
  },
  {
    id: 'sr', name: 'Support & Resistance',
    description: 'Key price levels where reversals often occur.',
    defaultEnabled: true,
  },
  {
    id: 'patterns', name: 'Candlestick Patterns',
    description: 'Detects Doji, Hammer, Engulfing, Morning Star and 7 more.',
    defaultEnabled: true,
  },
  {
    id: 'stochastic', name: 'Stochastic Oscillator',
    description: 'Momentum indicator comparing closing price to price range.',
    defaultEnabled: true,
    params: [
      { key: 'k', label: '%K Period', value: 14, min: 5, max: 30 },
      { key: 'd', label: '%D Period', value: 3, min: 2, max: 10 },
    ],
  },
  {
    id: 'atr', name: 'ATR (Average True Range)',
    description: 'Volatility measure used for stop-loss sizing.',
    defaultEnabled: true,
    params: [{ key: 'period', label: 'Period', value: 14, min: 5, max: 30 }],
  },
];

const AISettings: React.FC = () => {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(INDICATORS.map(i => [i.id, i.defaultEnabled]))
  );
  const [params, setParams] = useState<Record<string, Record<string, number>>>(
    Object.fromEntries(INDICATORS.map(i => [
      i.id,
      Object.fromEntries((i.params || []).map(p => [p.key, p.value]))
    ]))
  );
  const [defaultInterval, setDefaultInterval] = useState('5min');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In a real implementation, POST settings to backend
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">AI Settings</h1>
      <p className="text-gray-400 text-sm mb-6">
        Configure which indicators power the signal engine and their parameters.
      </p>

      {/* Default timeframe */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-3">Default Timeframe</h2>
        <div className="flex gap-3">
          {['1min', '5min', '15min'].map(tf => (
            <button
              key={tf}
              onClick={() => setDefaultInterval(tf)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                defaultInterval === tf
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              )}
            >
              {tf}
              {tf === '5min' && <span className="ml-1 text-xs opacity-70">(Recommended)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Scoring weights info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-3">Signal Scoring Weights</h2>
        <p className="text-gray-400 text-xs mb-3">
          Indicators are scored ±1 (bullish/bearish/neutral) and multiplied by weight.
          A weighted sum &gt; 2.5 → CALL, &lt; -2.5 → PUT, otherwise → WAIT.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'MACD', weight: 2.0 },
            { name: 'Candlestick Patterns', weight: 2.0 },
            { name: 'RSI', weight: 1.5 },
            { name: 'EMA Cross', weight: 1.5 },
            { name: 'Support/Resistance', weight: 1.5 },
            { name: 'Bollinger Bands', weight: 1.0 },
            { name: 'Trend Direction', weight: 1.0 },
          ].map(w => (
            <div key={w.name} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
              <span className="text-gray-300 text-xs">{w.name}</span>
              <span className="text-blue-400 text-xs font-bold">×{w.weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Indicator toggles */}
      <div className="space-y-3 mb-6">
        {INDICATORS.map(ind => (
          <div key={ind.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-white font-medium text-sm">{ind.name}</h3>
                <p className="text-gray-400 text-xs mt-0.5">{ind.description}</p>
              </div>
              <button
                onClick={() => setEnabled(e => ({ ...e, [ind.id]: !e[ind.id] }))}
                className={clsx(
                  'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ml-4',
                  enabled[ind.id] ? 'bg-blue-600' : 'bg-gray-700'
                )}
              >
                <span className={clsx(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5',
                  enabled[ind.id] ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            {/* Params */}
            {ind.params && enabled[ind.id] && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ind.params.map(p => (
                  <div key={p.key}>
                    <label className="text-gray-500 text-xs mb-1 block">{p.label}</label>
                    <input
                      type="number"
                      min={p.min}
                      max={p.max}
                      value={params[ind.id]?.[p.key] ?? p.value}
                      onChange={e => setParams(prev => ({
                        ...prev,
                        [ind.id]: { ...prev[ind.id], [p.key]: Number(e.target.value) }
                      }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Data provider info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-2">Data Provider</h2>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-900/50 border border-green-700 flex items-center justify-center">
            <span className="text-green-400 text-xs font-bold">TD</span>
          </div>
          <div>
            <p className="text-gray-200 text-sm font-medium">Twelve Data API</p>
            <p className="text-gray-500 text-xs">Real OHLCV candle data · API key stored server-side only</p>
          </div>
        </div>
        <p className="mt-3 text-gray-600 text-xs">
          Configure your API key in the backend <code className="text-blue-400">.env</code> file as{' '}
          <code className="text-blue-400">TWELVE_DATA_API_KEY</code>. Never expose it in the frontend.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default AISettings;
