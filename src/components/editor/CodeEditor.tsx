import React, { useRef, useCallback, Suspense, useEffect, useState } from 'react';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useSettingsStore } from '../../store/useSettingsStore';

const MonacoEditor = React.lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

const EditorSkeleton: React.FC = () => (
  <div className="w-full h-full flex flex-col gap-2 p-4" style={{ background: '#0e0e10' }}>
    {Array.from({ length: 20 }).map((_, i) => (
      <div key={i} className="skeleton h-4 rounded" style={{ width: `${40 + (i * 7) % 50}%` }} />
    ))}
  </div>
);

const FallbackEditor: React.FC<{ content: string }> = ({ content }) => (
  <textarea
    className="w-full h-full font-mono text-sm text-zinc-300 resize-none p-4 outline-none"
    style={{ background: '#0e0e10', border: 'none' }}
    value={content}
    readOnly
  />
);

const StickySubprogramHeader: React.FC<{ line: number }> = ({ line }) => {
  const { subprograms, selectedSubprogramId } = useSubprogramStore();
  const { activeFileId } = useFileStore();
  const currentSub = subprograms.find(
    (s) => s.fileId === activeFileId && s.startLine <= line && s.endLine >= line
  );
  if (!currentSub) return null;
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-b text-xs font-mono flex-shrink-0 overflow-hidden"
      style={{ background: 'rgba(14,14,16,0.97)', borderColor: 'var(--border-default)' }}
    >
      <span className="text-zinc-600 flex-shrink-0">{currentSub.kind}</span>
      <span className={`font-semibold flex-shrink-0 ${currentSub.id === selectedSubprogramId ? 'text-amber-400' : 'text-zinc-300'}`}>
        {currentSub.name}
      </span>
      <span className="text-zinc-600 truncate">
        ({currentSub.parameters.map((p) => `${p.name}: ${p.paramType}`).join('; ')})
      </span>
      {currentSub.returnType && (
        <span className="text-orange-400/70 flex-shrink-0">→ {currentSub.returnType}</span>
      )}
      <span className="ml-auto text-zinc-700 flex-shrink-0">L{currentSub.startLine}–{currentSub.endLine}</span>
    </div>
  );
};

// ── Single Monaco pane ────────────────────────────────────────────────────────
interface SingleEditorProps {
  fileId: string | null;
  onMount: (
    editor: import('monaco-editor').editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor')
  ) => void;
  onCursorChange?: (line: number) => void;
}

const SingleEditor: React.FC<SingleEditorProps> = ({ fileId, onMount, onCursorChange }) => {
  const { files } = useFileStore();
  const { fontSize, minimapEnabled } = useSettingsStore();
  const file = files.find((f) => f.id === fileId);
  const content = file?.content ?? '-- No file selected\n-- Open a file from the file manager';

  return (
    <Suspense fallback={<EditorSkeleton />}>
      <ErrorBoundaryEditor content={content}>
        {/*
          key={fileId} forces Monaco to fully remount when the active file changes.
          This is the correct way to switch files in Monaco — the value prop alone
          does not reliably update the editor content after initial mount.
        */}
        <MonacoEditor
          key={fileId ?? 'empty'}
          height="100%"
          defaultLanguage="ada"
          theme="ada-dark"
          defaultValue={content}
          options={{
            fontSize,
            fontFamily: '"JetBrains Mono", monospace',
            fontLigatures: true,
            minimap: { enabled: minimapEnabled },
            folding: true,
            lineNumbers: 'on',
            smoothScrolling: true,
            cursorBlinking: 'phase',
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            wordWrap: 'off',
            readOnly: false,
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            glyphMargin: true,
          }}
          onMount={(editor, monaco) => {
            onMount(editor, monaco);
            editor.onDidChangeCursorPosition((e) => {
              onCursorChange?.(e.position.lineNumber);
            });
          }}
        />
      </ErrorBoundaryEditor>
    </Suspense>
  );
};

// ── Main CodeEditor ───────────────────────────────────────────────────────────
export const CodeEditor: React.FC = () => {
  const { activeFileId } = useFileStore();
  const { highlightRange, setCursorPosition, openFileTabs, navigateRequest } = useEditorStore();
  const { selectedSubprogramId, subprograms } = useSubprogramStore();
  const { currentTestSets } = useTestCaseStore();
  const { splitEditor } = useSettingsStore();

  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const pendingNavRef = useRef<{ line: number } | null>(null);
  const [currentLine, setCurrentLine] = useState(1);

  const secondFileId = splitEditor
    ? openFileTabs.find((id) => id !== activeFileId) ?? null
    : null;

  // ── Execute navigation ────────────────────────────────────────────────────
  const executeNav = useCallback((line: number) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      pendingNavRef.current = { line };
      return;
    }
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
    const dec = editor.deltaDecorations([], [{
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: 'ada-nav-flash' },
    }]);
    setTimeout(() => editor.deltaDecorations(dec, []), 1400);
  }, []);

  // ── Editor mount ─────────────────────────────────────────────────────────
  const handleEditorMount = useCallback(
    (
      editor: import('monaco-editor').editor.IStandaloneCodeEditor,
      monaco: typeof import('monaco-editor')
    ) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      import('./adaLanguage').then(({ registerAdaLanguage }) => {
        registerAdaLanguage(monaco);
        monaco.editor.setTheme(useSettingsStore.getState().theme);
        const model = editor.getModel();
        if (model) monaco.editor.setModelLanguage(model, 'ada');
      });

      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition({ line: e.position.lineNumber, col: e.position.column });
        setCurrentLine(e.position.lineNumber);
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
        editor.getAction('editor.action.startFindReplaceAction')?.run();
      });

      // Flush pending navigation (arrived before this mount)
      if (pendingNavRef.current) {
        const { line } = pendingNavRef.current;
        pendingNavRef.current = null;
        setTimeout(() => executeNav(line), 150);
      }
    },
    [setCursorPosition, executeNav]
  );

  // ── Navigate on request ───────────────────────────────────────────────────
  useEffect(() => {
    if (!navigateRequest) return;
    // Give the key-based remount time to complete before scrolling
    const t = setTimeout(() => executeNav(navigateRequest.line), 200);
    return () => clearTimeout(t);
  }, [navigateRequest, executeNav]);

  // ── Decorations ───────────────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    const decs: import('monaco-editor').editor.IModelDeltaDecoration[] = [];

    if (selectedSubprogramId) {
      const sub = subprograms.find((s) => s.id === selectedSubprogramId);
      if (sub && sub.fileId === activeFileId) {
        decs.push({
          range: new monaco.Range(sub.startLine, 1, sub.endLine, 1),
          options: {
            isWholeLine: true,
            className: 'ada-highlight-line',
            glyphMarginClassName: 'ada-gutter-decoration',
            overviewRuler: { color: '#f59e0b', position: monaco.editor.OverviewRulerLane.Left },
          },
        });
      }
    }

    subprograms.forEach((sub) => {
      if (sub.fileId !== activeFileId) return;
      const tests = currentTestSets[sub.id] || [];
      const hasRun = tests.some((t) => t.runStatus === 'pass' || t.runStatus === 'fail');
      if (!hasRun) return;
      const hasFail = tests.some((t) => t.runStatus === 'fail');
      const allPass = tests.every((t) => t.runStatus === 'pass');
      decs.push({
        range: new monaco.Range(sub.startLine, 1, sub.startLine, 1),
        options: {
          glyphMarginClassName: hasFail
            ? 'ada-test-fail-gutter'
            : allPass ? 'ada-test-pass-gutter' : 'ada-test-partial-gutter',
          glyphMarginHoverMessage: {
            value: hasFail
              ? `❌ ${tests.filter((t) => t.runStatus === 'fail').length} failing`
              : `✅ All ${tests.length} passing`,
          },
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations([], decs);
  }, [selectedSubprogramId, subprograms, activeFileId, currentTestSets]);

  // ── Diagnostic markers ────────────────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    import('../../mocks/mockDiagnostics').then(({ mockDiagnostics }) => {
      const { files } = useFileStore.getState();
      const activeFile = files.find((f) => f.id === activeFileId);
      if (!activeFile) return;
      const markers = mockDiagnostics
        .filter((d) => d.file === activeFile.name)
        .map((d) => ({
          severity: d.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : d.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
          message: d.message,
          startLineNumber: d.line,
          startColumn: d.column,
          endLineNumber: d.line,
          endColumn: d.column + 20,
          source: 'Ada Analysis',
        }));
      monaco.editor.setModelMarkers(model, 'ada-diagnostics', markers);
    });
  }, [activeFileId]);

  // ── Legacy highlight range ────────────────────────────────────────────────
  useEffect(() => {
    if (editorRef.current && highlightRange) {
      editorRef.current.revealLineInCenter(highlightRange.start);
    }
  }, [highlightRange]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <style>{`
        .ada-highlight-line { background: rgba(245,158,11,0.08) !important; }
        .ada-gutter-decoration::before { content:'◈'; color:#f59e0b; font-size:12px; }
        .ada-test-pass-gutter::before { content:'✓'; color:#22c55e; font-size:11px; font-weight:bold; }
        .ada-test-fail-gutter::before { content:'✗'; color:#ef4444; font-size:11px; font-weight:bold; }
        .ada-test-partial-gutter::before { content:'~'; color:#f59e0b; font-size:11px; font-weight:bold; }
        @keyframes navFlash { 0%{background:rgba(245,158,11,0.4)} 60%{background:rgba(245,158,11,0.15)} 100%{background:transparent} }
        .ada-nav-flash { animation: navFlash 1.4s ease forwards !important; }
      `}</style>

      <StickySubprogramHeader line={currentLine} />

      <div className="flex flex-1 overflow-hidden">
        <div
          className={splitEditor ? 'w-1/2 border-r h-full' : 'w-full h-full'}
          style={{ borderColor: 'var(--border-default)' }}
        >
          <SingleEditor
            fileId={activeFileId}
            onMount={handleEditorMount}
            onCursorChange={setCurrentLine}
          />
        </div>
        {splitEditor && (
          <div className="w-1/2 h-full">
            <SingleEditor fileId={secondFileId} onMount={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
};

class ErrorBoundaryEditor extends React.Component<
  { children: React.ReactNode; content: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; content: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <FallbackEditor content={this.props.content} />;
    return this.props.children;
  }
}
