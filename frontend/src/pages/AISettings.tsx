import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  getOpenRouterConfig,
  saveOpenRouterConfig,
  getAiHealth,
} from '../services/api';

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

const OPENROUTER_MODELS = [
  { id: 'openrouter/free', label: 'openrouter/free (Auto Free Router — Recommended)' },
  { id: 'nvidia/nemotron-3.5-lightning:free', label: 'nvidia/nemotron-3.5-lightning:free' },
  { id: 'google/gemma-4-26b-a4b-it:free', label: 'google/gemma-4-26b-a4b-it:free' },
  { id: 'google/gemma-4-31b-it:free', label: 'google/gemma-4-31b-it:free' },
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
  const [openrouterKey, setOpenrouterKey] = useState(() => getOpenRouterConfig().apiKey);
  const [openrouterModel, setOpenrouterModel] = useState(() => getOpenRouterConfig().model);
  const [showKey, setShowKey] = useState(false);
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAiHealth()
      .then((res) => setServerConfigured(Boolean(res?.ai?.configured)))
      .catch(() => setServerConfigured(false));
  }, []);

  const handleSave = () => {
    saveOpenRouterConfig(openrouterKey, openrouterModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">AI Settings</h1>
      <p className="text-gray-400 text-sm mb-6">
        OpenRouter is configured as the sole LLM provider for UP/DOWN prediction and candle analysis.
      </p>

      {/* OpenRouter Sole LLM Config */}
      <div className="bg-gray-900 border border-blue-800/60 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div>
            <h2 className="text-white font-semibold flex items-center gap-2">
              <span>🤖 OpenRouter AI (Sole LLM Provider)</span>
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              All other LLMs removed. Uses OpenRouter exclusively for UP (CALL) / DOWN (PUT) candle analysis.
            </p>
          </div>
          <span
            className={clsx(
              'text-xs font-bold px-2.5 py-1 rounded-full border',
              openrouterKey || serverConfigured
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
                : 'bg-amber-950/70 text-amber-300 border-amber-700'
            )}
          >
            {openrouterKey
              ? 'Browser Key Active ✓'
              : serverConfigured
              ? 'Server ENV Active ✓'
              : 'Key Required'}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">
              OpenRouter API Key (<code className="text-blue-400">sk-or-v1-...</code>)
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg hover:bg-gray-700"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Stored locally in your browser &amp; sent securely via HTTPS header. On Render, you can also set <code className="text-blue-400">OPENROUTER_API_KEY</code> in Environment Variables.
            </p>
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1 block">OpenRouter Model</label>
            <select
              value={OPENROUTER_MODELS.some((m) => m.id === openrouterModel) ? openrouterModel : 'custom'}
              onChange={(e) => {
                if (e.target.value !== 'custom') setOpenrouterModel(e.target.value);
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            >
              {OPENROUTER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <option value="custom">Custom OpenRouter Model ID</option>
            </select>
            <input
              type="text"
              value={openrouterModel}
              onChange={(e) => setOpenrouterModel(e.target.value)}
              placeholder="e.g. openrouter/free or nvidia/nemotron-3.5-lightning:free"
              className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setOpenrouterKey('');
                saveOpenRouterConfig('', openrouterModel);
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear Saved Key
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {saved ? '✓ OpenRouter Activated' : 'Save & Activate OpenRouter'}
            </button>
          </div>
        </div>
      </div>

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
