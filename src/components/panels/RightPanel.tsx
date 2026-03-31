import React, { useState } from 'react';
import { FileManager } from '../file-manager/FileManager';
import { SubprogramExplorer } from '../subprogram/SubprogramExplorer';
import { PackageHierarchy } from '../file-manager/PackageHierarchy';

type RightTab = 'files' | 'outline' | 'packages';

const tabs: { id: RightTab; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'outline', label: 'Outline' },
  { id: 'packages', label: 'Packages' },
];

export const RightPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RightTab>('outline');

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
      {/* Tab bar */}
      <div
        className="flex items-center border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-default)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[10px] font-mono font-medium uppercase tracking-wider transition-all border-b-2 ${
              activeTab === tab.id
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-600 border-transparent hover:text-zinc-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'files' && <FileManager />}
        {activeTab === 'outline' && <SubprogramExplorer />}
        {activeTab === 'packages' && <PackageHierarchy />}
      </div>
    </div>
  );
};
