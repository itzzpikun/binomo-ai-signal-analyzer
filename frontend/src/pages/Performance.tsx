import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PerformanceSummary, Trade } from '../types';
import RiskWarning from '../components/common/RiskWarning';
import LoadingSpinner from '../components/common/LoadingSpinner';
import clsx from 'clsx';

const Performance: React.FC = () => {
  const [data, setData]         = useState<PerformanceSummary | null>(null);
  const [trades, setTrades]     = useState<Trade[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Form state for logging a trade
  const [showLogForm, setShowLogForm] = useState(false);
  const [formAsset, setFormAsset]     = useState('EUR/USD');
  const [formDir, setFormDir]         = useState<'CALL' | 'PUT'>('CALL');
  const [formEntry, setFormEntry]     = useState('');
  const [formExpiry, setFormExpiry]   = useState('5min');
  const [formStake, setFormStake]     = useState('10');
  const [formResult, setFormResult]   = useState<'WIN' | 'LOSS' | 'PENDING'>('WIN');
  const [submitting, setSubmitting]   = useState(false);

  const loadData = async () => {
    try {
      const [perfRes, tradeRes] = await Promise.all([
        api.getPerformance(),
        api.getTrades(100),
      ]);
      setData(perfRes);
      setTrades(tradeRes.trades || []);
    } catch {
      setError('Could not load performance or trade data. Backend may be offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEntry || isNaN(Number(formEntry))) {
      alert('Please enter a valid numeric entry price');
      return;
    }
    setSubmitting(true);
    try {
      await api.logTrade({
        asset: formAsset,
        direction: formDir,
        entry: parseFloat(formEntry),
        expiry: formExpiry,
        stake: parseFloat(formStake) || 10,
        result: formResult,
        time: new Date(),
      });
      setShowLogForm(false);
      setFormEntry('');
      await loadData();
    } catch (err: any) {
      alert('Failed to log trade: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateResult = async (id: string, result: 'WIN' | 'LOSS') => {
    try {
      await api.updateTrade(id, result);
      await loadData();
    } catch (err: any) {
      alert('Failed to update trade: ' + (err.response?.data?.message || err.message));
    }
  };

  const accuracyColor = (acc: number | null | undefined) => {
    if (acc == null) return 'text-gray-500';
    if (acc >= 60) return 'text-emerald-400';
    if (acc >= 45) return 'text-yellow-400';
    return 'text-red-400';
  };

  const riskStatus = data?.riskStatus;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Performance & Trade Log</h1>
          <p className="text-gray-400 text-sm">
            Audited trade log with automated negative-expectancy and daily loss risk protection.
          </p>
        </div>
        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          {showLogForm ? '✕ Cancel' : '➕ Record Trade'}
        </button>
      </div>

      <RiskWarning />

      {/* 🛑 Daily Risk Limit Hit Warning Banner */}
      {riskStatus?.dailyLimit?.active && (
        <div className="bg-red-950/80 border-2 border-red-500 rounded-xl p-4 my-4 text-red-200 flex items-start gap-3 shadow-lg shadow-red-950/50">
          <span className="text-2xl">🛑</span>
          <div>
            <h3 className="font-bold text-red-100 text-base tracking-wide">DAILY RISK LIMIT HIT</h3>
            <p className="text-sm text-red-200 mt-1 leading-relaxed">
              {riskStatus.dailyLimit.message}
            </p>
            <div className="mt-2 text-xs text-red-300 font-mono">
              Losses Today: <span className="font-bold text-white">{riskStatus.dailyLimit.lossesToday}</span> | 
              Daily P&L: <span className="font-bold text-white">${riskStatus.dailyLimit.pnlToday} ({riskStatus.dailyLimit.pnlTodayPct}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Negative Expectancy Warning Banner */}
      {riskStatus?.negativeExpectancy?.active && (
        <div className="bg-amber-950/70 border-2 border-yellow-500 rounded-xl p-4 my-4 text-yellow-200 flex items-start gap-3 shadow-lg shadow-yellow-950/50">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-yellow-100 text-base tracking-wide">NEGATIVE EXPECTANCY WARNING</h3>
            <p className="text-sm text-yellow-200 mt-1 leading-relaxed">
              {riskStatus.negativeExpectancy.message}
            </p>
            <div className="mt-2 text-xs text-yellow-300 font-mono">
              Sample Size: <span className="font-bold text-white">{riskStatus.negativeExpectancy.sampleSize} trades</span> | 
              Win Rate: <span className="font-bold text-white">{riskStatus.negativeExpectancy.winRate}%</span> | 
              Expectancy: <span className="font-bold text-white">-${Math.abs(riskStatus.negativeExpectancy.expectancyPerTrade).toFixed(2)}/trade</span>
            </div>
          </div>
        </div>
      )}

      {/* Manual Trade Log Form */}
      {showLogForm && (
        <form onSubmit={handleLogTrade} className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Log Executed Trade</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Asset</label>
              <select
                value={formAsset}
                onChange={(e) => setFormAsset(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="EUR/USD">EUR/USD</option>
                <option value="GBP/USD">GBP/USD</option>
                <option value="USD/JPY">USD/JPY</option>
                <option value="BTC/USD">BTC/USD</option>
                <option value="ETH/USD">ETH/USD</option>
                <option value="XAU/USD">XAU/USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Direction</label>
              <select
                value={formDir}
                onChange={(e) => setFormDir(e.target.value as 'CALL' | 'PUT')}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="CALL">CALL (UP)</option>
                <option value="PUT">PUT (DOWN)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Entry Price</label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 1.09250"
                value={formEntry}
                onChange={(e) => setFormEntry(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Expiry</label>
              <select
                value={formExpiry}
                onChange={(e) => setFormExpiry(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="1min">1 Minute</option>
                <option value="5min">5 Minutes</option>
                <option value="15min">15 Minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stake ($)</label>
              <input
                type="number"
                min="1"
                step="any"
                value={formStake}
                onChange={(e) => setFormStake(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Outcome</label>
              <select
                value={formResult}
                onChange={(e) => setFormResult(e.target.value as 'WIN' | 'LOSS' | 'PENDING')}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="WIN">WIN (+85%)</option>
                <option value="LOSS">LOSS (-100%)</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Trade Record'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center text-red-400 text-sm">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Trades',
                value: data?.totalSignals ?? trades.length,
                color: 'text-white',
                sub: `${data?.verifiedSignals ?? trades.filter(t => t.result !== 'PENDING').length} closed trades`,
              },
              {
                label: 'Win Rate',
                value: (data?.verifiedSignals ?? 0) > 0 ? `${Math.round(data?.accuracy ?? 0)}%` : 'N/A',
                color: accuracyColor(data?.accuracy),
                sub: (data?.verifiedSignals ?? 0) > 0 ? `${data?.wins}W / ${data?.losses}L` : 'No closed trades',
              },
              {
                label: 'Total P&L',
                value: data?.totalPnL !== undefined ? `${data.totalPnL >= 0 ? '+$' : '-$'}${Math.abs(data.totalPnL).toFixed(2)}` : '$0.00',
                color: (data?.totalPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                sub: `Profit Factor: ${(data?.profitFactor ?? 0) > 0 ? (data?.profitFactor ?? 0).toFixed(2) : 'N/A'}`,
              },
              {
                label: 'Best Asset',
                value: data?.bestAsset || 'N/A',
                color: 'text-purple-400',
                sub: 'min. 5 verified trades',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                <p className={clsx('text-xl font-bold break-all', stat.color)}>{stat.value}</p>
                {stat.sub && <p className="text-gray-600 text-xs mt-0.5">{stat.sub}</p>}
              </div>
            ))}
          </div>

          {/* Trade Log Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold text-gray-200">Real Trade Log</h2>
                <p className="text-xs text-gray-500">Every executed trade with exact entry, outcome, and P&L</p>
              </div>
              <span className="text-xs text-gray-400 font-mono bg-gray-800 px-2.5 py-1 rounded">
                {trades.length} recorded
              </span>
            </div>

            {trades.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No trades logged yet. Click <span className="text-blue-400 font-medium">"➕ Record Trade"</span> above to log an executed trade.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Time</th>
                      <th className="text-left px-4 py-3">Asset</th>
                      <th className="text-center px-4 py-3">Direction</th>
                      <th className="text-right px-4 py-3">Entry</th>
                      <th className="text-center px-4 py-3">Expiry</th>
                      <th className="text-right px-4 py-3">Stake</th>
                      <th className="text-center px-4 py-3">Result</th>
                      <th className="text-right px-4 py-3">P&L</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {trades.map((t, i) => {
                      const tradeId = t._id ? String(t._id) : String(i);
                      const isWin = t.result === 'WIN';
                      const isLoss = t.result === 'LOSS';
                      const isPending = t.result === 'PENDING';
                      const pnlVal = t.pnl ?? (isWin ? t.stake * 0.85 : isLoss ? -t.stake : 0);

                      return (
                        <tr key={tradeId} className="hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                            {new Date(t.time).toLocaleString([], {
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 font-medium text-white">{t.asset}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded text-xs font-bold uppercase',
                                t.direction === 'CALL'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-red-950 text-red-400 border border-red-800'
                              )}
                            >
                              {t.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-300">
                            {Number(t.entry).toFixed(5)}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-400">{t.expiry}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-300">${Number(t.stake).toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={clsx(
                                'px-2 py-0.5 rounded text-xs font-semibold',
                                isWin && 'bg-emerald-900/40 text-emerald-300 border border-emerald-700',
                                isLoss && 'bg-red-900/40 text-red-300 border border-red-700',
                                isPending && 'bg-yellow-900/40 text-yellow-300 border border-yellow-700'
                              )}
                            >
                              {t.result}
                            </span>
                          </td>
                          <td
                            className={clsx(
                              'px-4 py-3 text-right font-mono font-bold',
                              pnlVal > 0 ? 'text-emerald-400' : pnlVal < 0 ? 'text-red-400' : 'text-gray-400'
                            )}
                          >
                            {pnlVal > 0 ? `+$${pnlVal.toFixed(2)}` : pnlVal < 0 ? `-$${Math.abs(pnlVal).toFixed(2)}` : '$0.00'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isPending && (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleUpdateResult(tradeId, 'WIN')}
                                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs"
                                >
                                  Win
                                </button>
                                <button
                                  onClick={() => handleUpdateResult(tradeId, 'LOSS')}
                                  className="px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded text-xs"
                                >
                                  Loss
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Breakdown by Asset */}
          {data?.byAsset && data.byAsset.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-200">Performance By Asset</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Symbol</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Verified</th>
                    <th className="text-right px-4 py-3">Wins</th>
                    <th className="text-right px-4 py-3">Losses</th>
                    <th className="text-right px-4 py-3">Accuracy</th>
                    <th className="text-right px-4 py-3">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.byAsset.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-white">{row.symbol}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{row.totalSignals}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{row.verifiedSignals}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{row.wins}</td>
                      <td className="px-4 py-3 text-right text-red-400">{row.losses}</td>
                      <td className={clsx('px-4 py-3 text-right font-bold', accuracyColor(row.accuracy))}>
                        {row.verifiedSignals > 0 ? `${Math.round(row.accuracy)}%` : 'N/A'}
                      </td>
                      <td
                        className={clsx(
                          'px-4 py-3 text-right font-mono font-semibold',
                          (row.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}
                      >
                        {(row.pnl ?? 0) >= 0 ? `+$${(row.pnl ?? 0).toFixed(2)}` : `-$${Math.abs(row.pnl ?? 0).toFixed(2)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Performance;
