import React from 'react';
import { CodeEditor } from './CodeEditor';
import { EditorTabs } from './EditorTabs';
import { useEditorStore, EditorTab } from '../../store/useEditorStore';
import { TestCasePanel } from '../test-cases/TestCasePanel';
import { AnalysisOutput } from '../analysis/AnalysisOutput';
import { GraphViewer } from '../graph/GraphViewer';

const tabs: { id: EditorTab; label: string }[] = [
  { id: 'code', label: 'Code' },
  { id: 'tests', label: 'Test Cases' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'graph', label: 'Call Graph' },
];

export const EditorLayout: React.FC = () => {
  const { activeTab, setActiveTab } = useEditorStore();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div
        className="flex items-center border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium transition-all border-b-2 ${
              activeTab === tab.id
                ? 'text-amber-400 border-amber-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* File tabs (only for code view) */}
      {activeTab === 'code' && <EditorTabs />}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className="absolute inset-0 tab-content"
          style={{ opacity: activeTab === 'code' ? 1 : 0, pointerEvents: activeTab === 'code' ? 'auto' : 'none' }}
        >
          <CodeEditor />
        </div>
        <div
          className="absolute inset-0 tab-content overflow-auto"
          style={{ opacity: activeTab === 'tests' ? 1 : 0, pointerEvents: activeTab === 'tests' ? 'auto' : 'none' }}
        >
          <TestCasePanel />
        </div>
        <div
          className="absolute inset-0 tab-content overflow-auto"
          style={{ opacity: activeTab === 'analysis' ? 1 : 0, pointerEvents: activeTab === 'analysis' ? 'auto' : 'none' }}
        >
          <AnalysisOutput />
        </div>
        <div
          className="absolute inset-0 tab-content"
          style={{ opacity: activeTab === 'graph' ? 1 : 0, pointerEvents: activeTab === 'graph' ? 'auto' : 'none' }}
        >
          <GraphViewer />
        </div>
      </div>
    </div>
  );
};
