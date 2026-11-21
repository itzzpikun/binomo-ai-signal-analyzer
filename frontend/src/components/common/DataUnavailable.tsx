import React from 'react';

const DataUnavailable: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-3 select-none">
    <div className="text-5xl">⚠️</div>
    <p className="text-yellow-400 font-bold text-xl tracking-wide">DATA UNAVAILABLE</p>
    <p className="text-gray-400 text-sm text-center max-w-sm px-4">
      {message ||
        'Live market data is currently unavailable. Live signals are disabled until connection is restored.'}
    </p>
    <div className="mt-2 px-4 py-1.5 rounded-full border border-yellow-800 bg-yellow-900/20 text-yellow-400 text-xs">
      Check your TWELVE_DATA_API_KEY in the backend .env file
    </div>
  </div>
);

export default DataUnavailable;
