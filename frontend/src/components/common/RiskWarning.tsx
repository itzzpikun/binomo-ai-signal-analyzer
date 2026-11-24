import React from 'react';

const RiskWarning: React.FC = () => {
  return (
    <div className="bg-yellow-900/20 border border-yellow-500/40 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-yellow-400 text-lg flex-shrink-0 mt-0.5">⚠️</span>
        <div>
          <h4 className="text-yellow-400 font-semibold text-sm mb-1">RISK WARNING</h4>
          <p className="text-yellow-200/70 text-xs leading-relaxed">
            This tool provides technical analysis signals only. It does not guarantee profit or predict
            market movements with certainty. Trading involves significant risk of loss.{' '}
            <strong className="text-yellow-300">Never trade with money you cannot afford to lose.</strong>{' '}
            Past performance does not guarantee future results.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RiskWarning;
