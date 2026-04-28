import React, { useState } from 'react';
import { FileManager } from '../file-manager/FileManager';
import { SubprogramExplorer } from '../subprogram/SubprogramExplorer';
import { PackageHierarchy } from '../file-manager/PackageHierarchy';
import { ParsedJsonPanel } from '../file-manager/ParsedJsonPanel';
import { useParseStore } from '../../store/useParseStore';

type RightTab = 'files' | 'json' | 'outline' | 'packages';

export const RightPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RightTab>('files');
  const { results } = useParseStore();
  const parsedCount = Object.keys(results).length;

  // Auto-switch to JSON tab when a file is parsed
  React.useEffect(() => {
    if (parsedCount > 0) setActiveTab('json');
  }, [parsedCount]);

  const tabs: { id: RightTab; label: string; badge?: number }[] = [
    { id: 'files', label: 'Files' },
    { id: 'json', label: 'JSON', badge: parsedCount > 0 ? parsedCount : undefined },
    { id: 'outline', label: 'Outline' },
    { id: 'packages', label: 'Packages' },
  ];

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
            className="flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-mono font-medium uppercase tracking-wider transition-all border-b-2"
            style={{
              color: activeTab === tab.id ? '#facc15' : '#52525b',
              borderBottomColor: activeTab === tab.id ? '#facc15' : 'transparent',
              background: 'transparent',
            }}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className="text-[8px] font-mono px-1 rounded-full"
                style={{ background: 'rgba(250,204,21,0.2)', color: '#facc15' }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && (
          <div className="h-full overflow-y-auto">
            <FileManager />
          </div>
        )}
        {activeTab === 'json' && <ParsedJsonPanel />}
        {activeTab === 'outline' && (
          <div className="h-full overflow-hidden">
            <SubprogramExplorer />
          </div>
        )}
        {activeTab === 'packages' && (
          <div className="h-full overflow-y-auto">
            <PackageHierarchy />
          </div>
        )}
      </div>
    </div>
  );
};
