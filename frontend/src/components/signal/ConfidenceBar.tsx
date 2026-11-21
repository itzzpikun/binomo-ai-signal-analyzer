import React from 'react';
import clsx from 'clsx';
import type { SignalDirection } from '../../types';

interface ConfidenceBarProps {
  confidence: number;
  direction: SignalDirection;
}

const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ confidence, direction }) => {
  const colorMap: Record<SignalDirection, { bar: string; text: string }> = {
    CALL: { bar: 'bg-emerald-500', text: 'text-emerald-400' },
    PUT: { bar: 'bg-red-500', text: 'text-red-400' },
    WAIT: { bar: 'bg-yellow-500', text: 'text-yellow-400' },
  };

  const colors = colorMap[direction] || colorMap.WAIT;
  const clamped = Math.min(100, Math.max(0, confidence));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-gray-400 text-sm font-medium">Model Confidence</span>
        <span className={clsx('text-lg font-bold', colors.text)}>{clamped}%</span>
      </div>
      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-700 ease-out', colors.bar)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-gray-600 text-xs">0%</span>
        <span className="text-gray-600 text-xs">50%</span>
        <span className="text-gray-600 text-xs">100%</span>
      </div>
    </div>
  );
};

export default ConfidenceBar;
