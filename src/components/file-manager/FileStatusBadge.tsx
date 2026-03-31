import React from 'react';
import { FileStatus } from '../../types/file.types';

interface FileStatusBadgeProps {
  status: FileStatus;
}

const statusConfig: Record<FileStatus, { color: string; label: string; pulse?: boolean }> = {
  pending: { color: '#52525b', label: 'Pending' },
  parsing: { color: '#f59e0b', label: 'Parsing', pulse: true },
  parsed: { color: '#22c55e', label: 'Parsed' },
  error: { color: '#ef4444', label: 'Error' },
};

export const FileStatusBadge: React.FC<FileStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];

  return (
    <span title={config.label} className="flex items-center gap-1">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.pulse ? 'spin' : ''}`}
        style={{ background: config.color, boxShadow: `0 0 4px ${config.color}` }}
      />
    </span>
  );
};
