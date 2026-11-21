import React from 'react';
import clsx from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', className, message }) => {
  const sizeMap = {
    sm: 'w-5 h-5 border-2',
    md: 'w-10 h-10 border-4',
    lg: 'w-16 h-16 border-4',
  };

  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={clsx(
          'rounded-full border-blue-500 border-t-transparent animate-spin',
          sizeMap[size]
        )}
      />
      {message && (
        <p className="text-gray-400 text-sm">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
