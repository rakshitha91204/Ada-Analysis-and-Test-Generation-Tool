import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Diamond, Play, Download, Settings, ArrowLeft, ChevronDown, ChevronUp,
  Columns2, Map, ZoomIn, ZoomOut, Keyboard, Search,
} from 'lucide-react';
import { EditorLayout } from '../components/editor/EditorLayout';
import { RightPanel } from '../components/panels/RightPanel';
import { BottomPanel } from '../components/panels/BottomPanel';
import { PanelResizer } from '../components/panels/PanelResizer';
import { Breadcrumbs } from '../components/editor/Breadcrumbs';
import { IconButton } from '../components/shared/IconButton';
import { Tooltip } from '../components/shared/Tooltip';
import { CommandPalette } from '../components/shared/CommandPalette';
import { KeyboardShortcutsModal } from '../components/shared/KeyboardShortcutsModal';
import { useFileStore } from '../store/useFileStore';
import { useSubprogramStore } from '../store/useSubprogramStore';
import { useTestCaseStore } from '../store/useTestCaseStore';
import { useEditorStore } from '../store/useEditorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useFileParser } from '../hooks/useFileParser';
import { mockFiles } from '../mocks/mockFiles';
import { mockSubprograms } from '../mocks/mockSubprograms';
import { mockTestCaseSets, mockCurrentTestSets } from '../mocks/mockTestCases';

const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const { files, addFiles, setActiveFile } = useFileStore();
  const { setSubprograms, selectSubprogram } = useSubprogramStore();
  const { setHistory, setCurrentTests } = useTestCaseStore();
  const { rightPanelCollapsed, bottomPanelCollapsed, toggleRightPanel, toggleBottomPanel, openTab } = useEditorStore();
  const {
    rightPanelWidth, bottomPanelHeight, setRightPanelWidth, setBottomPanelHeight,
    fontSize, setFontSize, minimapEnabled, setMinimapEnabled, splitEditor, setSplitEditor,
  } = useSettingsStore();

  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const rightPanel = useResizablePanel(rightPanelWidth, 'horizontal', setRightPanelWidth, 180, 600);
  const bottomPanel = useResizablePanel(bottomPanelHeight, 'vertical', setBottomPanelHeight, 100, 500);

  // Initialize with mock data on first load
  useEffect(() => {
    if (files.length === 0) {
      addFiles(mockFiles);
      setActiveFile('file_calculator_adb');
    }
    setSubprograms(mockSubprograms);
    setHistory(mockTestCaseSets);
    Object.entries(mockCurrentTestSets).forEach(([subId, tests]) => {
      setCurrentTests(subId, tests);
    });
    selectSubprogram('sub_multiply');
  }, []); // eslint-disable-line

  useEffect(() => {
    if (files.length > 0) files.forEach((f) => openTab(f.id));
  }, [files.length]); // eslint-disable-line

  useFileParser();
  useKeyboardShortcuts(setCmdOpen);

  // ? key → shortcuts modal
  useEffect(() => {
    const h = () => setShortcutsOpen(true);
    window.addEventListener('ada:shortcuts', h);
    return () => window.removeEventListener('ada:shortcuts', h);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Topbar */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0 border-b"
        style={{ height: 40, background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Diamond size={16} className="text-amber-400" />
          <span className="text-xs font-mono font-semibold text-zinc-300 hidden sm:block">Ada IDE</span>
        </div>

        <div className="w-px h-5 bg-zinc-700 flex-shrink-0" />

        {/* Breadcrumbs */}
        <div className="flex-1 min-w-0">
          <Breadcrumbs />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Command palette */}
          <Tooltip content="Command Palette (Ctrl+K)">
            <IconButton icon={<Search size={14} />} label="Command Palette" onClick={() => setCmdOpen(true)} />
          </Tooltip>

          {/* Font size */}
          <Tooltip content="Decrease font size (Ctrl+-)">
            <IconButton icon={<ZoomOut size={13} />} label="Decrease font" onClick={() => setFontSize(fontSize - 1)} />
          </Tooltip>
          <span className="text-[10px] font-mono text-zinc-600 w-6 text-center">{fontSize}</span>
          <Tooltip content="Increase font size (Ctrl++)">
            <IconButton icon={<ZoomIn size={13} />} label="Increase font" onClick={() => setFontSize(fontSize + 1)} />
          </Tooltip>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          {/* Minimap toggle */}
          <Tooltip content={`${minimapEnabled ? 'Hide' : 'Show'} minimap (Ctrl+M)`}>
            <IconButton
              icon={<Map size={14} />}
              label="Toggle minimap"
              active={minimapEnabled}
              onClick={() => setMinimapEnabled(!minimapEnabled)}
            />
          </Tooltip>

          {/* Split editor */}
          <Tooltip content={`${splitEditor ? 'Single' : 'Split'} editor pane`}>
            <IconButton
              icon={<Columns2 size={14} />}
              label="Split editor"
              active={splitEditor}
              onClick={() => setSplitEditor(!splitEditor)}
            />
          </Tooltip>

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          {/* Run tests */}
          <Tooltip content="Run Tests (Ctrl+Enter)">
            <IconButton icon={<Play size={14} />} label="Run Tests" className="text-green-400 hover:bg-green-500/10" />
          </Tooltip>

          {/* Keyboard shortcuts */}
          <Tooltip content="Keyboard Shortcuts (?)">
            <IconButton icon={<Keyboard size={14} />} label="Shortcuts" onClick={() => setShortcutsOpen(true)} />
          </Tooltip>

          {/* Toggle right panel */}
          <Tooltip content="Toggle Right Panel (Ctrl+\\)">
            <IconButton
              icon={<Settings size={14} />}
              label="Toggle panel"
              onClick={toggleRightPanel}
              active={!rightPanelCollapsed}
            />
          </Tooltip>

          {/* Back */}
          <Tooltip content="Back to Upload">
            <IconButton icon={<ArrowLeft size={14} />} label="Back" onClick={() => navigate('/')} />
          </Tooltip>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <EditorLayout />
          </div>

          {!bottomPanelCollapsed && (
            <PanelResizer direction="vertical" onMouseDown={bottomPanel.onMouseDown} />
          )}

          {!bottomPanelCollapsed ? (
            <div style={{ height: bottomPanel.size, flexShrink: 0 }} className="overflow-hidden">
              <BottomPanel />
            </div>
          ) : (
            <div
              className="flex items-center justify-between px-3 border-t flex-shrink-0"
              style={{ height: 28, borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
            >
              <span className="text-[10px] font-mono text-zinc-600">DIAGNOSTICS</span>
              <button onClick={toggleBottomPanel} className="text-zinc-600 hover:text-zinc-400">
                <ChevronUp size={12} />
              </button>
            </div>
          )}
        </div>

        {!rightPanelCollapsed && (
          <PanelResizer direction="horizontal" onMouseDown={rightPanel.onMouseDown} />
        )}

        {!rightPanelCollapsed ? (
          <div
            style={{ width: rightPanel.size, flexShrink: 0, borderLeft: '1px solid var(--border-default)' }}
            className="overflow-hidden"
          >
            <RightPanel />
          </div>
        ) : (
          <div
            className="flex flex-col items-center py-2 gap-2 border-l flex-shrink-0"
            style={{ width: 28, borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
          >
            <button onClick={toggleRightPanel} className="text-zinc-600 hover:text-zinc-400">
              <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </div>
        )}
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};

export default EditorPage;
