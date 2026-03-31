import React, { useState } from 'react';
import { DiagnosticsPanel } from '../diagnostics/DiagnosticsPanel';
import { AnalysisOutput } from '../analysis/AnalysisOutput';
import { TestRunner } from '../test-cases/TestRunner';
import { ChevronDown } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';

type BottomTab = 'errors' | 'analysis' | 'runner';

const tabs: { id: BottomTab; label: string }[] = [
  { id: 'errors', label: 'Diagnostics' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'runner', label: 'Test Runner' },
];

export const BottomPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BottomTab>('errors');
  const { toggleBottomPanel } = useEditorStore();

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
      {/* Tab bar */}
      <div
        className="flex items-center justify-between border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-default)' }}
      >
        <div className="flex items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-amber-400 border-amber-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleBottomPanel}
          className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors mr-1"
          title="Collapse panel"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'errors' && <DiagnosticsPanel />}
        {activeTab === 'analysis' && <AnalysisOutput compact />}
        {activeTab === 'runner' && <TestRunner />}
      </div>
    </div>
  );
};
