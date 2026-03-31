import React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { IconButton } from '../shared/IconButton';
import { Tooltip } from '../shared/Tooltip';

interface GraphControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  scale: number;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  scale,
}) => {
  return (
    <div
      className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border p-1 shadow-lg"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
    >
      <Tooltip content="Zoom In">
        <IconButton icon={<ZoomIn size={14} />} onClick={onZoomIn} label="Zoom In" />
      </Tooltip>
      <div className="text-center text-[9px] font-mono text-zinc-600 py-0.5">
        {Math.round(scale * 100)}%
      </div>
      <Tooltip content="Zoom Out">
        <IconButton icon={<ZoomOut size={14} />} onClick={onZoomOut} label="Zoom Out" />
      </Tooltip>
      <div className="w-full h-px my-0.5" style={{ background: 'var(--border-default)' }} />
      <Tooltip content="Reset View">
        <IconButton icon={<Maximize2 size={14} />} onClick={onReset} label="Reset View" />
      </Tooltip>
    </div>
  );
};
