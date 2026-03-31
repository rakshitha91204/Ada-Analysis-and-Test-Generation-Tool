import React from 'react';
import { FileManager } from '../file-manager/FileManager';
import { SubprogramExplorer } from '../subprogram/SubprogramExplorer';

export const RightPanel: React.FC = () => {
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-surface)' }}
    >
      <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <FileManager />
      </div>
      <div className="flex-1 overflow-hidden">
        <SubprogramExplorer />
      </div>
    </div>
  );
};
