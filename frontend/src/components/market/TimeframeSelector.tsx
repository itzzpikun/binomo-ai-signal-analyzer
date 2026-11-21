import React from 'react';
import { useAppStore } from '../../store/appStore';
import type { TimeInterval } from '../../types';
import clsx from 'clsx';

const timeframes: { label: string; value: TimeInterval }[] = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
];

const TimeframeSelector: React.FC = () => {
  const selectedInterval = useAppStore((s) => s.selectedInterval);
  const setSelectedInterval = useAppStore((s) => s.setSelectedInterval);

  return (
    <div className="flex items-center bg-gray-800 rounded-lg p-0.5 border border-gray-700">
      {timeframes.map((tf) => (
        <button
          key={tf.value}
          onClick={() => setSelectedInterval(tf.value)}
          className={clsx(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            selectedInterval === tf.value
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          )}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
};

export default TimeframeSelector;
