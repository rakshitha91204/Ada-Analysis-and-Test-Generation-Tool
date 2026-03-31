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

// Sticky subprogram header shown above editor
const StickySubprogramHeader: React.FC<{ line: number }> = ({ line }) => {
  const { subprograms, selectedSubprogramId } = useSubprogramStore();
  const { files, activeFileId } = useFileStore();

  const currentSub = subprograms.find(
    (s) => s.fileId === activeFileId && s.startLine <= line && s.endLine >= line
  );

  if (!currentSub) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-b text-xs font-mono flex-shrink-0"
      style={{ background: 'rgba(14,14,16,0.95)', borderColor: 'var(--border-default)' }}
    >
      <span className="text-zinc-600">{currentSub.kind}</span>
      <span className={`font-semibold ${currentSub.id === selectedSubprogramId ? 'text-amber-400' : 'text-zinc-300'}`}>
        {currentSub.name}
      </span>
      <span className="text-zinc-600">
        ({currentSub.parameters.map((p) => `${p.name}: ${p.paramType}`).join('; ')})
      </span>
      {currentSub.returnType && (
        <span className="text-orange-400/70">→ {currentSub.returnType}</span>
      )}
      <span className="ml-auto text-zinc-700">L{currentSub.startLine}–{currentSub.endLine}</span>
    </div>
  );
};

interface SingleEditorProps {
  fileId: string | null;
  onMount: (editor: import('monaco-editor').editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => void;
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
        <MonacoEditor
          height="100%"
          defaultLanguage="ada"
          theme="ada-dark"
          value={content}
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
            find: { addExtraSpaceOnTop: false },
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

export const CodeEditor: React.FC = () => {
  const { files, activeFileId } = useFileStore();
  const { highlightRange, setCursorPosition, openFileTabs } = useEditorStore();
  const { selectedSubprogramId, subprograms } = useSubprogramStore();
  const { currentTestSets } = useTestCaseStore();
  const { splitEditor } = useSettingsStore();

  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const [currentLine, setCurrentLine] = useState(1);

  // Second pane file: pick the other open tab
  const secondFileId = splitEditor
    ? openFileTabs.find((id) => id !== activeFileId) ?? null
    : null;

  const handleEditorMount = useCallback(
    (editor: import('monaco-editor').editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      import('./adaLanguage').then(({ registerAdaLanguage }) => {
        registerAdaLanguage(monaco);
        const { theme } = useSettingsStore.getState();
        monaco.editor.setTheme(theme);
        const model = editor.getModel();
        if (model) monaco.editor.setModelLanguage(model, 'ada');
      });

      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition({ line: e.position.lineNumber, col: e.position.column });
        setCurrentLine(e.position.lineNumber);
      });

      // Ctrl+H → find & replace (Monaco built-in)
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
        editor.getAction('editor.action.startFindReplaceAction')?.run();
      });
    },
    [setCursorPosition]
  );

  // Subprogram highlight + inline test status decorations
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);

    const newDecorations: import('monaco-editor').editor.IModelDeltaDecoration[] = [];

    // Highlight selected subprogram
    if (selectedSubprogramId) {
      const sub = subprograms.find((s) => s.id === selectedSubprogramId);
      if (sub && sub.fileId === activeFileId) {
        newDecorations.push({
          range: new monaco.Range(sub.startLine, 1, sub.endLine, 1),
          options: {
            isWholeLine: true,
            className: 'ada-highlight-line',
            glyphMarginClassName: 'ada-gutter-decoration',
            overviewRuler: { color: '#f59e0b', position: monaco.editor.OverviewRulerLane.Left },
          },
        });
        editor.revealLineInCenter(sub.startLine);
      }
    }

    // Inline test status gutter decorations for all subprograms
    subprograms.forEach((sub) => {
      if (sub.fileId !== activeFileId) return;
      const tests = currentTestSets[sub.id] || [];
      if (tests.length === 0) return;

      const hasFail = tests.some((t) => t.runStatus === 'fail');
      const allPass = tests.every((t) => t.runStatus === 'pass');
      const hasRun = tests.some((t) => t.runStatus === 'pass' || t.runStatus === 'fail');

      if (!hasRun) return;

      newDecorations.push({
        range: new monaco.Range(sub.startLine, 1, sub.startLine, 1),
        options: {
          glyphMarginClassName: hasFail
            ? 'ada-test-fail-gutter'
            : allPass
            ? 'ada-test-pass-gutter'
            : 'ada-test-partial-gutter',
          glyphMarginHoverMessage: {
            value: hasFail
              ? `❌ ${tests.filter((t) => t.runStatus === 'fail').length} test(s) failing`
              : `✅ All ${tests.length} tests passing`,
          },
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations([], newDecorations);
  }, [selectedSubprogramId, subprograms, activeFileId, currentTestSets]);

  // Reveal highlight range
  useEffect(() => {
    if (editorRef.current && highlightRange) {
      editorRef.current.revealLineInCenter(highlightRange.start);
    }
  }, [highlightRange]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <style>{`
        .ada-highlight-line { background: rgba(245, 158, 11, 0.08) !important; }
        .ada-gutter-decoration::before { content: '◈'; color: #f59e0b; font-size: 12px; }
        .ada-test-pass-gutter::before { content: '✓'; color: #22c55e; font-size: 11px; font-weight: bold; }
        .ada-test-fail-gutter::before { content: '✗'; color: #ef4444; font-size: 11px; font-weight: bold; }
        .ada-test-partial-gutter::before { content: '~'; color: #f59e0b; font-size: 11px; font-weight: bold; }
      `}</style>

      <StickySubprogramHeader line={currentLine} />

      <div className="flex flex-1 overflow-hidden">
        {/* Primary editor */}
        <div className={`${splitEditor ? 'w-1/2 border-r' : 'w-full'} h-full`} style={{ borderColor: 'var(--border-default)' }}>
          <SingleEditor fileId={activeFileId} onMount={handleEditorMount} onCursorChange={setCurrentLine} />
        </div>

        {/* Split pane */}
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
