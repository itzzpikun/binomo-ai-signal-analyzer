import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Signal, SignalDirection } from '../types';
import clsx from 'clsx';
import LoadingSpinner from '../components/common/LoadingSpinner';

const directionStyle: Record<SignalDirection, string> = {
  CALL: 'text-emerald-400 bg-emerald-900/30 border-emerald-700',
  PUT:  'text-red-400 bg-red-900/30 border-red-700',
  WAIT: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
};

const directionIcon: Record<SignalDirection, string> = {
  CALL: '↑',
  PUT:  '↓',
  WAIT: '⏸',
};

const outcomeStyle: Record<string, string> = {
  WIN:     'text-emerald-400',
  LOSS:    'text-red-400',
  PENDING: 'text-gray-500',
};

const SignalHistory: React.FC = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');

  const fetchSignals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSignalHistory(symbol || undefined, 100);
      setSignals(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load signal history. Backend may be offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSignals(); }, [symbol]);

  const callCount  = signals.filter(s => s.direction === 'CALL').length;
  const putCount   = signals.filter(s => s.direction === 'PUT').length;
  const waitCount  = signals.filter(s => s.direction === 'WAIT').length;
  const verifiedWins  = signals.filter(s => s.outcome === 'WIN').length;
  const verifiedTotal = signals.filter(s => s.outcome === 'WIN' || s.outcome === 'LOSS').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Signal History</h1>
      <p className="text-gray-400 text-sm mb-6">
        All generated CALL/PUT/WAIT signals. Outcomes are verified post-facto — not pre-predicted.
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Signals', value: signals.length, color: 'text-white' },
          { label: 'CALL', value: callCount, color: 'text-emerald-400' },
          { label: 'PUT / WAIT', value: putCount + ' / ' + waitCount, color: 'text-red-400' },
          { label: 'Verified Accuracy', 
            value: verifiedTotal > 0 ? `${Math.round((verifiedWins/verifiedTotal)*100)}%` : 'N/A',
            color: 'text-blue-400',
            sub: verifiedTotal > 0 ? `${verifiedTotal} verified` : 'No verified signals yet'
          },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
            <p className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</p>
            {stat.sub && <p className="text-gray-600 text-xs mt-0.5">{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <input
          value={symbol}
          onChange={e => setSymbol(e.target.value.toUpperCase())}
          placeholder="Filter by symbol (e.g. EUR/USD)"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-64"
        />
        <button
          onClick={fetchSignals}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center text-red-400 text-sm">{error}</div>
      ) : signals.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500">No signals yet. Run an analysis on the Dashboard to generate signals.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Asset</th>
                <th className="text-left px-4 py-3">TF</th>
                <th className="text-left px-4 py-3">Signal</th>
                <th className="text-left px-4 py-3">Confidence</th>
                <th className="text-left px-4 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {signals.map((sig, i) => (
                <tr key={sig.id || i} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(sig.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{sig.symbol}</td>
                  <td className="px-4 py-3 text-gray-400">{sig.interval}</td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border',
                      directionStyle[sig.direction]
                    )}>
                      {directionIcon[sig.direction]} {sig.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-800 rounded-full h-1.5">
                        <div
                          className={clsx('h-1.5 rounded-full', sig.direction === 'CALL'
                            ? 'bg-emerald-500' : sig.direction === 'PUT' ? 'bg-red-500' : 'bg-yellow-500')}
                          style={{ width: `${sig.confidence}%` }}
                        />
                      </div>
                      <span className="text-gray-300 text-xs">{Math.round(sig.confidence)}%</span>
                    </div>
                  </td>
                  <td className={clsx('px-4 py-3 text-xs font-semibold', outcomeStyle[sig.outcome || 'PENDING'])}>
                    {sig.outcome || 'PENDING'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-gray-600 text-xs">
        * Confidence reflects the weighted indicator score, not a win probability guarantee.
      </p>
    </div>
  );
};

export default SignalHistory;
