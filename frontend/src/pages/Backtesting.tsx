import React, { useState } from 'react';
import { api } from '../services/api';
import { BacktestResult, TimeInterval, ASSET_CATEGORIES, AssetCategory } from '../types';
import LoadingSpinner from '../components/common/LoadingSpinner';
import clsx from 'clsx';

const allSymbols = (Object.keys(ASSET_CATEGORIES) as AssetCategory[])
  .flatMap(cat => ASSET_CATEGORIES[cat].map(a => a.symbol));

const Backtesting: React.FC = () => {
  const [symbol, setSymbol] = useState('Crypto IDX');
  const [interval, setInterval] = useState<TimeInterval>('1min');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [dataResponse, setDataResponse] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    setDataResponse(null);
    try {
      const data = await api.runBacktest({ symbol, interval, startDate, endDate });
      setDataResponse(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Backtest failed. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const result: BacktestResult | null = dataResponse?.result || null;
  const inSample = dataResponse?.result?.inSample;
  const outOfSample = dataResponse?.result?.outOfSample;
  const regimes = dataResponse?.result?.performanceByRegime;
  const profitFactor = dataResponse?.result?.profitFactor ?? 1.0;
  const maxDrawdown = dataResponse?.result?.maxDrawdown ?? 0;
  const payoutRate = dataResponse?.payoutRate || '83%';

  const accuracyColor = result
    ? result.accuracy >= 70
      ? 'text-emerald-400'
      : result.accuracy >= 60
      ? 'text-yellow-400'
      : 'text-red-400'
    : 'text-white';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Walk-Forward Historical Testing Engine</h1>
        <p className="text-gray-400 text-sm">
          Section 8: Out-of-sample testing, realistic binary payouts, zero look-ahead bias, and regime breakdown.
        </p>
      </div>

      {/* Realistic Validation Banner */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4 text-blue-300 text-xs sm:text-sm flex gap-3">
        <span className="text-lg">🛡️</span>
        <div>
          <p className="font-semibold text-white">Realistic Walk-Forward Protocol Active</p>
          <p className="text-gray-300 text-xs mt-0.5">
            Indicators are computed strictly on completed historical candles at the moment of entry. Binary option trades are evaluated on next-candle close with fixed {payoutRate} payout for wins and -100% for losses.
          </p>
        </div>
      </div>

      {/* Config form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <h2 className="text-white font-semibold mb-3 text-sm">Testing Parameters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-gray-400 mb-1 block">Symbol</label>
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
            >
              {allSymbols.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 mb-1 block">Timeframe</label>
            <select
              value={interval}
              onChange={e => setInterval(e.target.value as TimeInterval)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
            >
              <option value="1min">1 Minute (Binomo Preferred)</option>
              <option value="5min">5 Minutes</option>
              <option value="15min">15 Minutes</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 mb-1 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
            >
            </input>
          </div>
          <div>
            <label className="text-gray-400 mb-1 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
            >
            </input>
          </div>
        </div>
        <div className="mt-4 flex justify-between items-center pt-3 border-t border-gray-800">
          <span className="text-[11px] text-gray-400 font-mono">
            Payout Model: {payoutRate} • Min 100-Point Score: ≥75
          </span>
          <button
            onClick={runBacktest}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <LoadingSpinner size="sm" />}
            {loading ? 'Simulating Walk-Forward…' : 'Run Walk-Forward Backtest'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-base">Walk-Forward Results: {symbol} ({interval})</h2>
            <span className="text-xs text-gray-400 font-mono">
              Candles Analyzed: {dataResponse?.candlesAnalyzed}
            </span>
          </div>

          {/* Primary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Verified Signals', value: result.totalSignals, color: 'text-white' },
              { label: 'Overall Win Rate', value: `${result.accuracy}%`, color: accuracyColor },
              { label: 'Profit Factor', value: profitFactor.toFixed(2), color: profitFactor >= 1.2 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Max Drawdown', value: `-${maxDrawdown}%`, color: maxDrawdown <= 200 ? 'text-emerald-400' : 'text-red-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                <p className={clsx('text-2xl font-bold font-mono', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* In-Sample vs Out-of-Sample Validation Cards */}
          {(inSample || outOfSample) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-300">In-Sample Training (70% Data)</span>
                  <span className="text-xs font-mono font-bold text-blue-400">{inSample?.winRate ?? 0}% Win Rate</span>
                </div>
                <p className="text-xs text-gray-400">
                  {inSample?.trades} trades across {inSample?.candles} historical candles.
                </p>
              </div>
              <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-300">Out-of-Sample Testing (30% Data)</span>
                  <span className={clsx('text-xs font-mono font-bold', (outOfSample?.winRate ?? 0) >= 55 ? 'text-emerald-400' : 'text-amber-400')}>
                    {outOfSample?.winRate ?? 0}% Win Rate
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {outOfSample?.trades} unseen validation trades. No data leakage.
                </p>
              </div>
            </div>
          )}

          {/* Performance By Market Regime */}
          {regimes && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                Performance By Market Regime
              </h3>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <p className="text-emerald-400 font-bold mb-1">TRENDING</p>
                  <p className="text-lg font-bold text-white">{regimes.trending?.winRate ?? 0}%</p>
                  <p className="text-[10px] text-gray-500">{regimes.trending?.wins}W / {regimes.trending?.losses}L</p>
                </div>
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <p className="text-amber-400 font-bold mb-1">RANGING (Chop)</p>
                  <p className="text-lg font-bold text-white">{regimes.ranging?.winRate ?? 0}%</p>
                  <p className="text-[10px] text-gray-500">{regimes.ranging?.wins}W / {regimes.ranging?.losses}L</p>
                </div>
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800">
                  <p className="text-red-400 font-bold mb-1">VOLATILE (Spike)</p>
                  <p className="text-lg font-bold text-white">{regimes.volatile?.winRate ?? 0}%</p>
                  <p className="text-[10px] text-gray-500">{regimes.volatile?.wins}W / {regimes.volatile?.losses}L</p>
                </div>
              </div>
            </div>
          )}

          {/* Signal log table */}
          {result.signals && result.signals.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-200">Historical Walk-Forward Signal Log</span>
                <span className="text-[11px] text-gray-500 font-mono">Latest 100 Trades</span>
              </div>
              <div className="overflow-auto max-h-80 scrollbar-thin">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider text-[10px]">
                      <th className="text-left px-4 py-2">Timestamp</th>
                      <th className="text-left px-4 py-2">Signal</th>
                      <th className="text-left px-4 py-2">Score</th>
                      <th className="text-left px-4 py-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 font-mono">
                    {result.signals.slice(0, 100).map((sig, i) => (
                      <tr key={i} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2 text-gray-400">
                          {new Date(sig.timestamp).toLocaleTimeString()}
                        </td>
                        <td
                          className={clsx(
                            'px-4 py-2 font-semibold',
                            sig.direction === 'CALL'
                              ? 'text-emerald-400'
                              : sig.direction === 'PUT'
                              ? 'text-red-400'
                              : 'text-yellow-400'
                          )}
                        >
                          {sig.direction === 'CALL' ? '↑' : sig.direction === 'PUT' ? '↓' : '⏸'} {sig.direction}
                        </td>
                        <td className="px-4 py-2 text-gray-300">{Math.round(sig.confidence)}/100</td>
                        <td
                          className={clsx(
                            'px-4 py-2 font-bold',
                            sig.outcome === 'WIN' ? 'text-emerald-400' : 'text-red-400'
                          )}
                        >
                          {sig.outcome || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Backtesting;
