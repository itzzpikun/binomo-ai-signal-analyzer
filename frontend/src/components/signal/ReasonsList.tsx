import React from 'react';
import type { SignalReasons } from '../../types';
import clsx from 'clsx';

interface ReasonsListProps {
  reasons: SignalReasons;
}

const ReasonsList: React.FC<ReasonsListProps> = ({ reasons }) => {
  const bullish = Array.isArray(reasons?.bullish) ? reasons.bullish : [];
  const bearish = Array.isArray(reasons?.bearish) ? reasons.bearish : [];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">
        Signal Reasoning
      </h3>

      <div className="space-y-3">
        {/* Bullish reasons */}
        {bullish.length > 0 && (
          <div>
            <p className="text-emerald-400/70 text-xs font-medium mb-1.5 flex items-center gap-1">
              <span>↑</span> Bullish Factors ({bullish.length})
            </p>
            <ul className="space-y-1">
              {bullish.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bearish reasons */}
        {bearish.length > 0 && (
          <div className={clsx(bullish.length > 0 && 'pt-3 border-t border-gray-800')}>
            <p className="text-red-400/70 text-xs font-medium mb-1.5 flex items-center gap-1">
              <span>↓</span> Bearish Factors ({bearish.length})
            </p>
            <ul className="space-y-1">
              {bearish.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {bullish.length === 0 && bearish.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-2">
            No reasoning data available
          </p>
        )}
      </div>
    </div>
  );
};

export default ReasonsList;
