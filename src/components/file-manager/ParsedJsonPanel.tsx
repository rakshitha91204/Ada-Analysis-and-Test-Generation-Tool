import React, { Suspense, useCallback, useRef, useState } from 'react';
import { Zap, TestTube, Copy, Check, Download, AlertCircle } from 'lucide-react';
import { useParseStore } from '../../store/useParseStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { showToast } from '../shared/Toast';
import { Subprogram } from '../../types/subprogram.types';

const MonacoEditor = React.lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

interface ParsedSubprogramJson {
  id: string;
  name: string;
  kind: 'procedure' | 'function';
  parameters: Array<{ name: string; paramType: string; mode: 'in' | 'out' | 'in out' }>;
  returnType: string | null;
  startLine: number;
  endLine: number;
}

export const ParsedJsonPanel: React.FC = () => {
  const { results, activeResultFileId, updateJsonText, setActiveResult } = useParseStore();
  const { generateTests, setCurrentTests } = useTestCaseStore();
  const { setSubprograms, subprograms } = useSubprogramStore();
  const { setActiveTab } = useEditorStore();
  const [generating, setGenerating] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  const activeResult = activeResultFileId ? results[activeResultFileId] : null;
  const allResults = Object.values(results);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeResultFileId || value === undefined) return;
      updateJsonText(activeResultFileId, value);
      // Validate JSON live
      try {
        JSON.parse(value);
        setJsonError(null);
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
      }
    },
    [activeResultFileId, updateJsonText]
  );

  const handleGenerateTests = () => {
    if (!activeResult) return;
    setJsonError(null);

    let parsed: { subprograms: ParsedSubprogramJson[] };
    try {
      parsed = JSON.parse(activeResult.jsonText);
    } catch (e) {
      setJsonError('Cannot generate tests — JSON is invalid. Fix the JSON first.');
      return;
    }

    if (!parsed.subprograms || !Array.isArray(parsed.subprograms)) {
      setJsonError('JSON must have a "subprograms" array.');
      return;
    }

    setGenerating(true);

    // Convert JSON subprograms back to Subprogram objects and merge into store
    const jsonSubs: Subprogram[] = parsed.subprograms.map((s) => ({
      id: s.id || `${activeResult.fileId}_${s.name}_${s.startLine}`,
      fileId: activeResult.fileId,
      name: s.name,
      kind: s.kind,
      parameters: s.parameters || [],
      returnType: s.returnType ?? undefined,
      startLine: s.startLine,
      endLine: s.endLine,
      testCount: 0,
    }));

    // Merge into subprogram store (keep existing from other files)
    const otherSubs = subprograms.filter((s) => s.fileId !== activeResult.fileId);
    setSubprograms([...otherSubs, ...jsonSubs]);

    // Generate test cases for each subprogram
    let delay = 0;
    jsonSubs.forEach((sub) => {
      setTimeout(() => {
        generateTests(sub);
      }, delay);
      delay += 100;
    });

    setTimeout(() => {
      setGenerating(false);
      setActiveTab('tests');
      showToast(`Generated tests for ${jsonSubs.length} subprogram(s) from JSON`, 'success');
    }, delay + 200);
  };

  const handleCopy = () => {
    if (!activeResult) return;
    navigator.clipboard.writeText(activeResult.jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeResult) return;
    const blob = new Blob([activeResult.jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeResult.fileName.replace(/\.(ads|adb)$/, '')}_parsed.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (allResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.15)' }}>
          <Zap size={22} style={{ color: '#facc15' }} />
        </div>
        <div>
          <p className="text-sm font-mono font-semibold" style={{ color: '#e4e4e7' }}>No files parsed yet</p>
          <p className="text-xs font-mono mt-1" style={{ color: '#52525b' }}>
            Go to the Files tab, hover a file,<br />and click the <span style={{ color: '#facc15' }}>Parse</span> button
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* File selector tabs */}
      {allResults.length > 1 && (
        <div className="flex overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid #1c1c1c' }}>
          {allResults.map((r) => (
            <button
              key={r.fileId}
              onClick={() => setActiveResult(r.fileId)}
              className="px-3 py-2 text-[10px] font-mono whitespace-nowrap transition-colors border-b-2"
              style={{
                color: activeResultFileId === r.fileId ? '#facc15' : '#52525b',
                borderBottomColor: activeResultFileId === r.fileId ? '#facc15' : 'transparent',
                background: 'transparent',
              }}
            >
              {r.fileName}
            </button>
          ))}
        </div>
      )}

      {activeResult && (
        <>
          {/* Toolbar */}
          <div
            className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
            style={{ borderBottom: '1px solid #1c1c1c' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono truncate" style={{ color: '#52525b' }}>
                {activeResult.fileName}
              </p>
              <p className="text-[9px] font-mono" style={{ color: '#3f3f46' }}>
                {(() => {
                  try {
                    const d = JSON.parse(activeResult.jsonText);
                    return `${d.subprograms?.length ?? 0} subprograms · editable`;
                  } catch {
                    return 'Invalid JSON';
                  }
                })()}
              </p>
            </div>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded transition-colors"
              style={{ color: copied ? '#4ade80' : '#52525b' }}
              title="Copy JSON"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>

            <button
              onClick={handleDownload}
              className="p-1.5 rounded transition-colors"
              style={{ color: '#52525b' }}
              title="Download JSON"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#facc15'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
            >
              <Download size={13} />
            </button>
          </div>

          {/* JSON error banner */}
          {jsonError && (
            <div
              className="flex items-start gap-2 px-3 py-2 flex-shrink-0 text-[10px] font-mono"
              style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{jsonError}</span>
            </div>
          )}

          {/* Monaco JSON editor */}
          <div className="flex-1 overflow-hidden">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full spin" style={{ borderColor: '#facc15' }} />
              </div>
            }>
              <MonacoEditor
                key={activeResult.fileId}
                height="100%"
                language="json"
                theme="vs-dark"
                value={activeResult.jsonText}
                onChange={handleEditorChange}
                onMount={(editor) => { editorRef.current = editor; }}
                options={{
                  fontSize: 12,
                  fontFamily: '"JetBrains Mono", monospace',
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  folding: true,
                  scrollBeyondLastLine: false,
                  wordWrap: 'off',
                  automaticLayout: true,
                  padding: { top: 8, bottom: 8 },
                  formatOnPaste: true,
                  tabSize: 2,
                }}
              />
            </Suspense>
          </div>

          {/* Generate Tests button */}
          <div
            className="flex-shrink-0 p-3"
            style={{ borderTop: '1px solid #1c1c1c' }}
          >
            <button
              onClick={handleGenerateTests}
              disabled={generating || !!jsonError}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono font-semibold text-sm transition-all"
              style={{
                background: generating || jsonError ? 'rgba(250,204,21,0.08)' : 'rgba(250,204,21,0.15)',
                color: generating || jsonError ? '#52525b' : '#facc15',
                border: `1px solid ${generating || jsonError ? '#2a2a2a' : 'rgba(250,204,21,0.4)'}`,
                cursor: generating || jsonError ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!generating && !jsonError) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(250,204,21,0.22)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  generating || jsonError ? 'rgba(250,204,21,0.08)' : 'rgba(250,204,21,0.15)';
              }}
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full spin" style={{ borderColor: '#facc15' }} />
                  Generating tests...
                </>
              ) : (
                <>
                  <TestTube size={15} />
                  Generate Tests from JSON
                </>
              )}
            </button>
            <p className="text-center text-[9px] font-mono mt-1.5" style={{ color: '#3f3f46' }}>
              Edit the JSON above before generating · changes are preserved
            </p>
          </div>
        </>
      )}
    </div>
  );
};
