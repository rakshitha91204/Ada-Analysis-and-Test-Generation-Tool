import React from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'muted';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  animate?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  secondary: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  success: 'bg-green-500/20 text-green-400 border border-green-500/30',
  danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  muted: 'bg-zinc-700/40 text-zinc-400 border border-zinc-700/50',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'muted',
  className = '',
  animate = false,
}) => {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${variantStyles[variant]} ${animate ? 'badge-bounce' : ''} ${className}`}
    >
      {children}
    </span>
  );
};
