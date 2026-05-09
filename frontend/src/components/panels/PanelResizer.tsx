import React from 'react';

interface PanelResizerProps {
  direction: 'horizontal' | 'vertical';
  onMouseDown: (e: React.MouseEvent) => void;
}

export const PanelResizer: React.FC<PanelResizerProps> = ({ direction, onMouseDown }) => {
  const isHorizontal = direction === 'horizontal';

  return (
    <div
      onMouseDown={onMouseDown}
      className={`panel-resizer flex-shrink-0 group ${
        isHorizontal ? 'w-1 cursor-col-resize hover:w-1' : 'h-1 cursor-row-resize hover:h-1'
      }`}
      style={{
        width: isHorizontal ? 4 : '100%',
        height: isHorizontal ? '100%' : 4,
        background: 'var(--border-default)',
        transition: 'background 0.15s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--border-default)';
      }}
    />
  );
};
