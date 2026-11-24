import React, { useState } from 'react';
import { api } from '../services/api';
import { BacktestResult, TimeInterval, ASSET_CATEGORIES, AssetCategory } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import clsx from 'clsx';

const allSymbols = (Object.keys(ASSET_CATEGORIES) as AssetCategory[])
  .flatMap(cat => ASSET_CATEGORIES[cat].map(a => a.symbol));

const Backtesting: React.FC = () => {
  const [symbol, setSymbol] = useState('EUR/USD');
  const [interval, setInterval] = useState<TimeInterval>('5min');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate]   = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<BacktestResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.runBacktest({ symbol, interval, startDate, endDate });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Backtest failed. Backend may be offline.');
    } finally {
      setLoading(false);
    }
  };

  const accuracyColor = result
    ? result.accuracy >= 60 ? 'text-emerald-400'
      : result.accuracy >= 45 ? 'text-yellow-400'
      : 'text-red-400'
    : 'text-white';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Backtesting</h1>
      <p className="text-gray-400 text-sm mb-6">
        Test the signal strategy on historical candle data. Walk-forward analysis only — no look-ahead bias.
      </p>

      {/* Warning */}
      <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 mb-6 text-yellow-300 text-sm flex gap-3">
        <span>⚠️</span>
        <span>Past backtest performance does not guarantee future results. Historical patterns may not repeat.</span>
      </div>

      {/* Config form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-4">Configuration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Symbol</label>
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {allSymbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Interval</label>
            <select
              value={interval}
              onChange={e => setInterval(e.target.value as TimeInterval)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="1min">1 Minute</option>
              <option value="5min">5 Minutes (Default)</option>
              <option value="15min">15 Minutes</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={runBacktest}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <LoadingSpinner size="sm" />}
            {loading ? 'Running…' : 'Run Backtest'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm mb-6">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <h2 className="text-white font-semibold">Results</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Signals', value: result.totalSignals, color: 'text-white' },
              { label: 'Verified', value: result.verifiedSignals, color: 'text-blue-400' },
              { label: 'Wins', value: result.wins, color: 'text-emerald-400' },
              { label: 'Accuracy', value: result.verifiedSignals > 0
                  ? `${Math.round(result.accuracy)}%`
                  : 'N/A', color: accuracyColor },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                <p className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Signal log table */}
          {result.signals && result.signals.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-semibold text-gray-200">Signal Log</span>
              </div>
              <div className="overflow-auto max-h-80 scrollbar-thin">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2">Time</th>
                      <th className="text-left px-4 py-2">Signal</th>
                      <th className="text-left px-4 py-2">Confidence</th>
                      <th className="text-left px-4 py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {result.signals.slice(0, 200).map((sig, i) => (
                      <tr key={i} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2 text-gray-400">
                          {new Date(sig.timestamp).toLocaleString()}
                        </td>
                        <td className={clsx('px-4 py-2 font-semibold',
                          sig.direction === 'CALL' ? 'text-emerald-400'
                          : sig.direction === 'PUT' ? 'text-red-400'
                          : 'text-yellow-400'
                        )}>
                          {sig.direction === 'CALL' ? '↑' : sig.direction === 'PUT' ? '↓' : '⏸'} {sig.direction}
                        </td>
                        <td className="px-4 py-2 text-gray-300">{Math.round(sig.confidence)}%</td>
                        <td className={clsx('px-4 py-2 font-semibold',
                          sig.outcome === 'WIN'  ? 'text-emerald-400'
                          : sig.outcome === 'LOSS' ? 'text-red-400'
                          : 'text-gray-500'
                        )}>
                          {sig.outcome || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="text-gray-600 text-xs">
            * Only non-WAIT signals are counted in accuracy. WAIT signals are excluded from win/loss calculation.
          </p>
        </div>
      )}
    </div>
  );
};

export default Backtesting;
