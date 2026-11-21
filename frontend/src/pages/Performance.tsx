import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { PerformanceSummary } from '../types';
import RiskWarning from '../components/common/RiskWarning';
import LoadingSpinner from '../components/common/LoadingSpinner';
import clsx from 'clsx';

const Performance: React.FC = () => {
  const [data, setData]       = useState<PerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.getPerformance();
        setData(result);
      } catch {
        setError('Could not load performance data. Backend may be offline.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const accuracyColor = (acc: number | null | undefined) => {
    if (acc == null) return 'text-gray-500';
    if (acc >= 60) return 'text-emerald-400';
    if (acc >= 45) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Performance</h1>
      <p className="text-gray-400 text-sm mb-4">
        Verified signal accuracy. Only signals with confirmed outcomes (WIN/LOSS) are counted.
      </p>

      <RiskWarning />

      <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4 my-4 text-blue-300 text-sm flex gap-3">
        <span>ℹ️</span>
        <span>
          Accuracy is calculated only from verified signals. If sample size is small (&lt; 20),
          results may not be statistically significant. Never treat this as a prediction of future performance.
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center text-red-400 text-sm">{error}</div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Signals', value: data.totalSignals, color: 'text-white' },
              { label: 'Verified', value: data.verifiedSignals, color: 'text-blue-400',
                sub: 'with WIN/LOSS outcome' },
              { label: 'Win Rate',
                value: data.verifiedSignals > 0
                  ? `${Math.round(data.accuracy)}%`
                  : 'N/A',
                color: accuracyColor(data.accuracy),
                sub: data.verifiedSignals > 0
                  ? `${data.wins}W / ${data.losses}L`
                  : 'No verified signals' },
              { label: 'Best Asset', value: data.bestAsset || 'N/A', color: 'text-purple-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                <p className={clsx('text-xl font-bold break-all', stat.color)}>{stat.value}</p>
                {stat.sub && <p className="text-gray-600 text-xs mt-0.5">{stat.sub}</p>}
              </div>
            ))}
          </div>

          {/* Per-asset table */}
          {data.byAsset && data.byAsset.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-200">By Asset</h2>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-timeframe */}
          {data.byTimeframe && data.byTimeframe.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-200">By Timeframe</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Interval</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Verified</th>
                    <th className="text-right px-4 py-3">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.byTimeframe.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-white">
                        {row.interval}
                        {row.interval === '5min' && (
                          <span className="ml-2 text-xs text-blue-400 border border-blue-700 rounded-full px-1.5 py-0.5">Default</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{row.totalSignals}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{row.verifiedSignals}</td>
                      <td className={clsx('px-4 py-3 text-right font-bold', accuracyColor(row.accuracy))}>
                        {row.verifiedSignals > 0 ? `${Math.round(row.accuracy)}%` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.verifiedSignals === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
              <p className="text-gray-500">
                No verified signals yet. Run analyses on the Dashboard, then verify outcomes to track performance.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Performance;
