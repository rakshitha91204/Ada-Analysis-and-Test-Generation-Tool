import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  heading: string;
  subtext?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  heading,
  subtext,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
      <div className="text-zinc-600 opacity-60" style={{ fontSize: 48 }}>
        {icon}
      </div>
      <p className="text-zinc-400 font-medium text-sm">{heading}</p>
      {subtext && <p className="text-zinc-600 text-xs max-w-xs">{subtext}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/10 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
