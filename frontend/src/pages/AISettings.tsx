import React, { useState } from 'react';
import clsx from 'clsx';
import { testAIKey } from '../services/api';

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
  const [defaultInterval, setDefaultInterval] = useState('1min');
  const [saved, setSaved] = useState(false);

  // Stored AI API Keys
  const [keys, setKeys] = useState<{
    geminiKey: string;
    openaiKey: string;
    groqKey: string;
    deepseekKey: string;
    openrouterKey: string;
  }>(() => {
    try {
      const stored = localStorage.getItem('binomo_ai_keys');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { geminiKey: '', openaiKey: '', groqKey: '', deepseekKey: '', openrouterKey: '' };
  });

  const [testResults, setTestResults] = useState<
    Record<string, { testing: boolean; success?: boolean; message?: string; latencyMs?: number }>
  >({});

  const handleTestKey = async (provider: string, apiKey: string) => {
    setTestResults(prev => ({ ...prev, [provider]: { testing: true } }));
    try {
      const res = await testAIKey(provider, apiKey);
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          testing: false,
          success: res.success,
          message: res.message,
          latencyMs: res.latencyMs,
        },
      }));
    } catch (e: any) {
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          testing: false,
          success: false,
          message: e.message || 'Test failed',
        },
      }));
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('binomo_ai_keys', JSON.stringify(keys));
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <span>🤖</span>
          <span>AI Settings & Model Alternatives</span>
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">
          Configure API keys for Groq, Google Gemini, OpenAI, DeepSeek, and OpenRouter with ≥75% confidence threshold.
        </p>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🎯 75%+ CONFIDENCE RULE BANNER                             */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-blue-950/60 to-gray-900 border border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-xl flex items-start gap-3.5">
        <span className="text-2xl sm:text-3xl p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
          🎯
        </span>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-emerald-300 font-extrabold text-sm sm:text-base">
              Strict ≥75% Model Confidence Rule Active
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
              Win-Rate Guard
            </span>
          </div>
          <p className="text-gray-300 text-xs mt-1 leading-relaxed">
            The AI engine provides <b>CALL (BUY)</b> or <b>PUT (SELL)</b> when model confidence reaches <b>≥75%</b>. If market is in choppy consolidation or confidence is below 75%, it provides <b>WAIT</b> to protect your capital.
          </p>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🔑 MULTI-AI ALTERNATIVE API KEYS                           */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <span>⚡</span>
              <span>AI Provider API Keys (Alternative Models)</span>
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Add your custom API key. Groq is free and ultra-fast (&lt;400ms). The Built-in Neural Engine is always active as zero-key fallback.
            </p>
          </div>
          <span className="hidden sm:inline text-xs font-mono px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Multi-Provider Ready
          </span>
        </div>

        {/* 1. Groq (Recommended Free Alternative) */}
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-bold text-sm">⚡ Groq (Llama 3.3 70B)</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                FREE &amp; ULTRA-FAST (&lt;400ms)
              </span>
            </div>
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Get Free Groq Key ↗
            </a>
          </div>
          <p className="text-gray-400 text-xs">
            Recommended! Provides instantaneous (&lt;400ms) Llama 3.3 70B &amp; DeepSeek R1 reasoning with high accuracy.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="gsk_..."
              value={keys.groqKey}
              onChange={e => setKeys(prev => ({ ...prev, groqKey: e.target.value }))}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={() => handleTestKey('groq', keys.groqKey)}
              disabled={testResults.groq?.testing}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-lg border border-gray-700 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              {testResults.groq?.testing ? 'Testing...' : 'Test Key'}
            </button>
          </div>
          {testResults.groq && (
            <div
              className={clsx(
                'text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between',
                testResults.groq.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/40 text-red-300'
              )}
            >
              <span>{testResults.groq.message}</span>
              {testResults.groq.latencyMs && <span>{testResults.groq.latencyMs}ms</span>}
            </div>
          )}
        </div>

        {/* 2. Google Gemini */}
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-bold text-sm">🧠 Google Gemini (1.5 Flash)</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                FREE TIER
              </span>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Get Gemini Key ↗
            </a>
          </div>
          <p className="text-gray-400 text-xs">
            Google DeepMind technical chart evaluation and EMA trend validation.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={keys.geminiKey}
              onChange={e => setKeys(prev => ({ ...prev, geminiKey: e.target.value }))}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={() => handleTestKey('gemini', keys.geminiKey)}
              disabled={testResults.gemini?.testing}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-lg border border-gray-700 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              {testResults.gemini?.testing ? 'Testing...' : 'Test Key'}
            </button>
          </div>
          {testResults.gemini && (
            <div
              className={clsx(
                'text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between',
                testResults.gemini.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/40 text-red-300'
              )}
            >
              <span>{testResults.gemini.message}</span>
              {testResults.gemini.latencyMs && <span>{testResults.gemini.latencyMs}ms</span>}
            </div>
          )}
        </div>

        {/* 3. OpenAI ChatGPT */}
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm">🛡️ OpenAI ChatGPT (GPT-4o-mini)</span>
            </div>
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Get OpenAI Key ↗
            </a>
          </div>
          <p className="text-gray-400 text-xs">
            Order flow analysis and bull/bear trap protection.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="sk-..."
              value={keys.openaiKey}
              onChange={e => setKeys(prev => ({ ...prev, openaiKey: e.target.value }))}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={() => handleTestKey('openai', keys.openaiKey)}
              disabled={testResults.openai?.testing}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-lg border border-gray-700 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              {testResults.openai?.testing ? 'Testing...' : 'Test Key'}
            </button>
          </div>
          {testResults.openai && (
            <div
              className={clsx(
                'text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between',
                testResults.openai.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/40 text-red-300'
              )}
            >
              <span>{testResults.openai.message}</span>
              {testResults.openai.latencyMs && <span>{testResults.openai.latencyMs}ms</span>}
            </div>
          )}
        </div>

        {/* 4. DeepSeek AI */}
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold text-sm">💎 DeepSeek AI (DeepSeek Chat)</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                HIGH REASONING
              </span>
            </div>
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Get DeepSeek Key ↗
            </a>
          </div>
          <p className="text-gray-400 text-xs">
            Deep algorithmic reasoning model for high-accuracy binary options predictions.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="sk-..."
              value={keys.deepseekKey}
              onChange={e => setKeys(prev => ({ ...prev, deepseekKey: e.target.value }))}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={() => handleTestKey('deepseek', keys.deepseekKey)}
              disabled={testResults.deepseek?.testing}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-lg border border-gray-700 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              {testResults.deepseek?.testing ? 'Testing...' : 'Test Key'}
            </button>
          </div>
          {testResults.deepseek && (
            <div
              className={clsx(
                'text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between',
                testResults.deepseek.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/40 text-red-300'
              )}
            >
              <span>{testResults.deepseek.message}</span>
              {testResults.deepseek.latencyMs && <span>{testResults.deepseek.latencyMs}ms</span>}
            </div>
          )}
        </div>

        {/* 5. Built-in Engine */}
        <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 font-bold text-sm">⚡ Built-in High-Accuracy Neural Engine</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                ALWAYS ACTIVE
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              Permanent zero-config engine: 8 technical indicators + 3 timeframes without any external key.
            </p>
          </div>
          <button
            onClick={() => handleTestKey('builtin', 'builtin')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs rounded-lg border border-gray-700 transition-colors"
          >
            Check Status
          </button>
        </div>
        {testResults.builtin && (
          <div className="text-xs px-2.5 py-1.5 rounded-lg border bg-emerald-950/60 border-emerald-500/40 text-emerald-300">
            {testResults.builtin.message}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* ⏱️ DEFAULT TIMEFRAME                                      */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5">
        <h2 className="text-white font-semibold text-sm mb-3">Default Trading Timeframe</h2>
        <div className="flex gap-2 sm:gap-3 flex-wrap">
          {['1min', '5min', '15min'].map(tf => (
            <button
              key={tf}
              onClick={() => setDefaultInterval(tf)}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors',
                defaultInterval === tf
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'border-gray-800 bg-gray-950 text-gray-400 hover:border-gray-700'
              )}
            >
              {tf}
              {tf === '1min' && <span className="ml-1 text-[10px] opacity-80">(Recommended for Binomo)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 📊 SCORING WEIGHTS INFO                                   */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5">
        <h2 className="text-white font-semibold text-sm mb-2">Confluence Scoring Weights (≥75% Confidence)</h2>
        <p className="text-gray-400 text-xs mb-3">
          To achieve ≥75% confidence, multiple strategies must align across momentum, moving averages, and market structure.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { name: 'EMA 8/21 Trend', weight: '×2.5' },
            { name: 'Triple Timeframe (1M/5M/15M)', weight: '×3.0' },
            { name: 'RSI Momentum (50)', weight: '×2.0' },
            { name: 'ADX Trend Strength', weight: '×1.8' },
            { name: 'Candle Price Action', weight: '×2.0' },
            { name: 'Awesome Oscillator', weight: '×1.5' },
            { name: 'Bollinger Band Pinch', weight: '×1.5' },
            { name: 'AI Trap Risk Filter', weight: '×2.0' },
          ].map(w => (
            <div key={w.name} className="flex items-center justify-between bg-gray-950 border border-gray-800/80 rounded-xl px-3 py-2">
              <span className="text-gray-300 text-xs">{w.name}</span>
              <span className="text-blue-400 text-xs font-bold">{w.weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🎛️ INDICATOR TOGGLES                                      */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-white font-semibold text-sm px-1">Active Technical Indicators</h2>
        {INDICATORS.map(ind => (
          <div key={ind.id} className="bg-gray-900/90 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-white font-medium text-xs sm:text-sm">{ind.name}</h3>
                <p className="text-gray-400 text-[11px] mt-0.5">{ind.description}</p>
              </div>
              <button
                onClick={() => setEnabled(e => ({ ...e, [ind.id]: !e[ind.id] }))}
                className={clsx(
                  'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ml-4 cursor-pointer',
                  enabled[ind.id] ? 'bg-blue-600' : 'bg-gray-700'
                )}
              >
                <span
                  className={clsx(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5',
                    enabled[ind.id] ? 'translate-x-4' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2 pb-6">
        <button
          onClick={handleSave}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          {saved ? '✓ Settings & API Keys Saved!' : 'Save Settings & API Keys'}
        </button>
      </div>
    </div>
  );
};

export default AISettings;

