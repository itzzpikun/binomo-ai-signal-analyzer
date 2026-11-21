import React from 'react';
import clsx from 'clsx';
import type { ConnectionStatus } from '../../types';

interface StatusBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config: Record<ConnectionStatus, { dot: string; text: string; label: string }> = {
    connected: {
      dot: 'bg-emerald-400',
      text: 'text-emerald-400',
      label: 'Connected',
    },
    disconnected: {
      dot: 'bg-gray-500',
      text: 'text-gray-500',
      label: 'Disconnected',
    },
    error: {
      dot: 'bg-red-400',
      text: 'text-red-400',
      label: 'Error',
    },
  };

  const { dot, text, label } = config[status];

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <span className={clsx('w-2 h-2 rounded-full', dot, status === 'connected' && 'animate-pulse')} />
      <span className={clsx('text-xs font-medium', text)}>{label}</span>
    </div>
  );
};

export default StatusBadge;
