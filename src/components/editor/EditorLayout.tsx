import React from 'react';
import { CodeEditor } from './CodeEditor';
import { EditorTabs } from './EditorTabs';
import { useEditorStore, EditorTab } from '../../store/useEditorStore';
import { TestCasePanel } from '../test-cases/TestCasePanel';
import { AnalysisOutput } from '../analysis/AnalysisOutput';
import { GraphViewer } from '../graph/GraphViewer';
import { Code2, TestTube, BarChart2, GitBranch, ChevronRight } from 'lucide-react';
import { useParseStore } from '../../store/useParseStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';

const VIEW_TABS: { id: EditorTab; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: 'code',     label: 'Code',       icon: <Code2 size={13} />,    shortcut: '⌥1' },
  { id: 'tests',    label: 'Test Cases',  icon: <TestTube size={13} />,  shortcut: '⌥2' },
  { id: 'analysis', label: 'Analysis',   icon: <BarChart2 size={13} />, shortcut: '⌥3' },
  { id: 'graph',    label: 'Call Graph',  icon: <GitBranch size={13} />, shortcut: '⌥4' },
];

// ── Subprogram breadcrumb strip ───────────────────────────────────────────────
const CodeBreadcrumb: React.FC = () => {
  const { results, activeResultFileId } = useParseStore();
  const { subprograms, selectedSubprogramId } = useSubprogramStore();
  const { setActiveTab, navigateTo } = useEditorStore();

  const activeResult = activeResultFileId ? results[activeResultFileId] : null;
  const fileName = activeResult?.fileName ?? '';
  const selectedSub = subprograms.find(s => s.id === selectedSubprogramId);

  if (!fileName) return null;

  return (
    <div
      className="flex items-center gap-1 px-3 overflow-hidden flex-shrink-0"
      style={{
        height: 24,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-default)',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <span className="text-ellipsis" style={{ color: 'var(--text-muted)', maxWidth: 200 }}>
        {fileName}
      </span>
      {selectedSub && (
        <>
          <ChevronRight size={9} style={{ color: 'var(--text-disabled)', flexShrink: 0 }} />
          <button
            onClick={() => {
              setActiveTab('code');
              navigateTo(selectedSub.startLine, selectedSub.fileId ?? '', selectedSub.id);
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={`Go to ${selectedSub.name} (line ${selectedSub.startLine})`}
          >
            {selectedSub.name}
          </button>
          <span className="ml-auto flex-shrink-0" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
            Ln {selectedSub.startLine}
          </span>
        </>
      )}
    </div>
  );
};

// ── Subprogram count badge ────────────────────────────────────────────────────
const SubpBadge: React.FC = () => {
  const { subprograms } = useSubprogramStore();
  if (subprograms.length === 0) return null;
  return (
    <span className="inline-badge badge-muted" style={{ fontSize: 9, marginLeft: 4 }}>
      {subprograms.length}
    </span>
  );
};

// ── Main EditorLayout ─────────────────────────────────────────────────────────
export const EditorLayout: React.FC = () => {
  const { activeTab, setActiveTab } = useEditorStore();

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>

      {/* View tabs */}
      <div className="view-tabs" role="tablist">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`view-tab ${activeTab === tab.id ? 'active' : ''}`}
            title={`${tab.label} (${tab.shortcut})`}
          >
            <span style={{ opacity: activeTab === tab.id ? 1 : 0.55 }}>{tab.icon}</span>
            {tab.label}
            {tab.id === 'tests' && <SubpBadge />}
          </button>
        ))}
      </div>

      {/* File tabs + breadcrumb (code only) */}
      {activeTab === 'code' && (
        <>
          <EditorTabs />
          <CodeBreadcrumb />
        </>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 tab-content"
          style={{ opacity: activeTab === 'code' ? 1 : 0, pointerEvents: activeTab === 'code' ? 'auto' : 'none' }}>
          <CodeEditor />
        </div>
        <div className="absolute inset-0 tab-content overflow-auto"
          style={{ opacity: activeTab === 'tests' ? 1 : 0, pointerEvents: activeTab === 'tests' ? 'auto' : 'none' }}>
          <TestCasePanel />
        </div>
        <div className="absolute inset-0 tab-content overflow-hidden"
          style={{ opacity: activeTab === 'analysis' ? 1 : 0, pointerEvents: activeTab === 'analysis' ? 'auto' : 'none' }}>
          <AnalysisOutput />
        </div>
        <div className="absolute inset-0 tab-content"
          style={{ opacity: activeTab === 'graph' ? 1 : 0, pointerEvents: activeTab === 'graph' ? 'auto' : 'none' }}>
          <GraphViewer />
        </div>
      </div>
    </div>
  );
};
