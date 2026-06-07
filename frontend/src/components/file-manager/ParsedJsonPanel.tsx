import React, { Suspense, useCallback, useRef, useState } from 'react';
import { Zap, TestTube, Copy, Check, Download, AlertCircle, Loader, X, RefreshCw } from 'lucide-react';
import { useParseStore } from '../../store/useParseStore';
import { useFileStore } from '../../store/useFileStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useFileParser } from '../../hooks/useFileParser';
import { showToast } from '../shared/Toast';
import { Subprogram } from '../../types/subprogram.types';

const MonacoEditor = React.lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

interface ParsedSubprogramJson {
  id?: string;
  name: string;
  kind?: 'procedure' | 'function';
  parameters: string[];
  return_type?: string | null;   // backend format
  returnType?: string | null;    // old format
  start_line?: number;           // backend format
  end_line?: number;             // backend format
  startLine?: number;            // old format
  endLine?: number;              // old format
}

export const ParsedJsonPanel: React.FC = () => {
  const { results, activeResultFileId, updateJsonText, setActiveResult, clearResult } = useParseStore();
  const { files } = useFileStore();
  const { generateTests, setCurrentTests } = useTestCaseStore();
  const { setSubprograms, subprograms } = useSubprogramStore();
  const { setActiveTab } = useEditorStore();
  const { parseFile } = useFileParser();
  const [generating, setGenerating] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  const activeResult = activeResultFileId ? results[activeResultFileId] : null;
  const allResults = Object.values(results);

  const activeFile = activeResultFileId
    ? files.find((f) => f.id === activeResultFileId)
    : null;
  const isParsing = activeFile && (activeFile.status === 'parsing' || activeFile.status === 'pending');

  // Detect stale/cached JSON — check for TRUE duplicates (same name AND same params)
  // Overloaded subprograms (same name, different params) are valid Ada - not duplicates
  const isStaleJson = (() => {
    if (!activeResult) return false;
    try {
      const d = JSON.parse(activeResult.jsonText);
      const fp = d.file_paths?.[0] ?? '';
      const subs = d.subprogram_index?.[fp] ?? [];
      // A true duplicate has same name AND same start_line (nested body indexed twice)
      const signatures = subs.map((s: {name: string; start_line?: number}) =>
        `${s.name}::${s.start_line ?? 0}`
      );
      return signatures.length !== new Set(signatures).size;
    } catch { return false; }
  })();

  // Re-parse the active file with fresh analysis
  const handleReParse = useCallback(async () => {
    if (!activeFile || reparsing) return;
    setReparsing(true);
    clearResult(activeFile.id);
    try {
      await parseFile(activeFile);
      showToast(`Re-parsed ${activeFile.name} with latest analyzer`, 'success');
    } catch {
      showToast(`Re-parse failed for ${activeFile.name}`, 'error');
    }
    setReparsing(false);
  }, [activeFile, parseFile, clearResult, reparsing]);

  // Remove a file's JSON result and switch to another if available
  const handleRemoveResult = useCallback((fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    clearResult(fileId);
    // Switch to another result if one exists
    const remaining = Object.keys(results).filter((id) => id !== fileId);
    setActiveResult(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    showToast('JSON result removed', 'info');
  }, [results, clearResult, setActiveResult]);

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

    let parsed: { subprograms?: ParsedSubprogramJson[]; meta?: { fileName: string }; subprogram_index?: Record<string, ParsedSubprogramJson[]>; file_paths?: string[] };
    try {
      parsed = JSON.parse(activeResult.jsonText);
    } catch (e) {
      setJsonError('Cannot generate tests — JSON is invalid. Fix the JSON first.');
      return;
    }

    // Support both old format (subprograms[]) and new backend format (subprogram_index)
    let subEntries: ParsedSubprogramJson[] = [];
    if (parsed.subprogram_index) {
      const filePath = parsed.file_paths?.[0] ?? Object.keys(parsed.subprogram_index)[0];
      subEntries = parsed.subprogram_index[filePath] ?? [];
    } else if (parsed.subprograms && Array.isArray(parsed.subprograms)) {
      subEntries = parsed.subprograms;
    }

    if (subEntries.length === 0) {
      setJsonError('No subprograms found in JSON. Check the subprogram_index field.');
      return;
    }

    setGenerating(true);

    const jsonSubs: Subprogram[] = subEntries.map((s) => {
      // Parse parameters from "name : mode type" strings
      const params = (s.parameters || []).map((p: string) => {
        const parts = p.split(':').map((x: string) => x.trim());
        const namePart = parts[0] ?? 'param';
        const typePart = parts[1] ?? 'Unknown';
        const modeMatch = /^(in\s+out|in|out)\s+(.+)$/i.exec(typePart);
        return {
          name: namePart,
          paramType: modeMatch ? modeMatch[2].trim() : typePart,
          mode: (modeMatch ? modeMatch[1].toLowerCase().trim() : 'in') as 'in' | 'out' | 'in out',
        };
      });
      return {
        id: s.id || `${activeResult.fileId}_${s.name}_${s.start_line ?? s.startLine ?? 0}`,
        fileId: activeResult.fileId,
        name: s.name,
        kind: (s.return_type ?? s.returnType) ? 'function' : 'procedure' as 'function' | 'procedure',
        parameters: params,
        returnType: (s.return_type ?? s.returnType) ?? undefined,
        startLine: s.start_line ?? s.startLine ?? 0,
        endLine: s.end_line ?? s.endLine ?? 0,
        testCount: 0,
      };
    });

    const otherSubs = subprograms.filter((s) => s.fileId !== activeResult.fileId);
    setSubprograms([...otherSubs, ...jsonSubs]);

    let delay = 0;
    jsonSubs.forEach((sub) => {
      setTimeout(() => { generateTests(sub); }, delay);
      delay += 100;
    });

    setTimeout(() => {
      setGenerating(false);
      setActiveTab('tests');
      showToast(
        `Generated tests for ${jsonSubs.length} subprogram(s) from ${parsed.meta?.fileName ?? activeResult.fileName}`,
        'success'
      );
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
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.15)' }}>
          <Zap size={22} style={{ color: '#facc15' }} />
        </div>
        <div>
          <p className="text-sm font-mono font-semibold" style={{ color: '#e4e4e7' }}>No JSON yet</p>
          <p className="text-xs font-mono mt-1" style={{ color: '#52525b' }}>
            Click any file in the <span style={{ color: '#facc15' }}>Files</span> tab<br />
            to parse it and generate its JSON
          </p>
        </div>
      </div>
    );
  }

  // File is selected and currently being parsed
  if (activeResultFileId && !activeResult && isParsing) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0a0a' }}>
        {/* Tabs for already-parsed files */}
        {allResults.length > 0 && (
          <div className="flex overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid #1c1c1c' }}>
            {allResults.map((r) => (
              <div key={r.fileId} className="flex items-center group">
                <button
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
                <button
                  onClick={(e) => handleRemoveResult(r.fileId, e)}
                  className="mr-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                  style={{ color: '#52525b' }}
                  title="Remove JSON result"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <Loader size={22} className="animate-spin" style={{ color: '#facc15' }} />
          <p className="text-sm font-mono font-semibold" style={{ color: '#e4e4e7' }}>
            Analyzing {activeFile?.name ?? 'file'}...
          </p>
          <p className="text-xs font-mono" style={{ color: '#52525b' }}>Running libadalang analysis</p>
        </div>
      </div>
    );
  }

  // File selected but not yet parsed — show prompt
  if (activeResultFileId && !activeResult) {
    return (
      <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0a0a' }}>
        {/* Tabs for already-parsed files */}
        {allResults.length > 0 && (
          <div className="flex overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid #1c1c1c' }}>
            {allResults.map((r) => (
              <div key={r.fileId} className="flex items-center group">
                <button
                  onClick={() => setActiveResult(r.fileId)}
                  className="px-3 py-2 text-[10px] font-mono whitespace-nowrap transition-colors border-b-2"
                  style={{
                    color: '#52525b',
                    borderBottomColor: 'transparent',
                    background: 'transparent',
                  }}
                >
                  {r.fileName}
                </button>
                <button
                  onClick={(e) => handleRemoveResult(r.fileId, e)}
                  className="mr-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                  style={{ color: '#52525b' }}
                  title="Remove JSON result"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col items-center justify-center flex-1 gap-4 p-6 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.15)' }}>
            <Zap size={22} style={{ color: '#facc15' }} />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold" style={{ color: '#e4e4e7' }}>
              {activeFile?.name ?? 'File'} — not parsed yet
            </p>
            <p className="text-xs font-mono mt-1" style={{ color: '#52525b' }}>
              Click the file in the <span style={{ color: '#facc15' }}>Files</span> tab<br />
              to parse it and generate its JSON
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* File selector tabs — each with a ✕ remove button */}
      {allResults.length > 0 && (
        <div className="flex overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid #1c1c1c' }}>
          {allResults.map((r) => (
            <div key={r.fileId} className="flex items-center group flex-shrink-0">
              <button
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
              {/* ✕ remove this file's JSON */}
              <button
                onClick={(e) => handleRemoveResult(r.fileId, e)}
                className="mr-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                style={{ color: '#52525b' }}
                title="Remove JSON result"
              >
                <X size={9} />
              </button>
            </div>
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
                    const d = JSON.parse(activeResult.jsonText) as import('../../utils/adaAnalyzer').AdaAnalysisResult;
                    const filePath = d.file_paths?.[0] ?? '';
                    const subs = d.subprogram_index?.[filePath]?.length ?? 0;
                    // Support both new schema (globals/locals lists + summary) and legacy (nested dicts)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const varInfo: any = (d.variables_info as any)?.[filePath] ?? {};
                    const localVars: number =
                      varInfo.summary?.total_locals
                      ?? varInfo.locals?.length
                      ?? Object.values(varInfo.local_variables ?? {}).reduce((a: number, v: unknown) => a + Object.keys(v as object).length, 0);
                    const globalVars: number =
                      varInfo.summary?.total_globals
                      ?? varInfo.globals?.length
                      ?? Object.values(varInfo.global_variables ?? {}).reduce((a: number, v: unknown) => a + Object.keys(v as object).length, 0);
                    const paramsCount: number = varInfo.summary?.total_params ?? varInfo.parameters?.length ?? 0;
                    const constsCount: number = varInfo.summary?.total_constants ?? varInfo.globals?.filter((g: {is_constant: boolean}) => g.is_constant).length ?? 0;
                    const dead = d.dead_code?.length ?? 0;
                    const bugs = d.bug_report
                      ? (d.bug_report.division_by_zero.length + d.bug_report.null_dereference.length +
                         d.bug_report.infinite_loops.length + d.bug_report.unreachable_code.length)
                      : 0;
                    const loops = Object.values(d.loop_info ?? {}).reduce((a: number, v: unknown) => a + (typeof v === 'number' ? v : 0), 0);
                    const tasks = d.concurrency_info?.tasks?.length ?? 0;
                    const harness = Object.values(d.test_harness_data ?? {}).reduce((a, v) => a + v.length, 0);
                    const stubs = Object.keys(d.mock_stub_data ?? {}).length;
                    const astKind = d.ast_info ? Object.values(d.ast_info)[0] : null;
                    const parts = [
                      `${subs} subprograms`,
                      `${localVars} local vars`,
                      globalVars > 0 ? `${globalVars} global vars` : null,
                      paramsCount > 0 ? `${paramsCount} params` : null,
                      constsCount > 0 ? `${constsCount} constants` : null,
                      `${dead} dead code`,
                      bugs > 0 ? `${bugs} bugs` : null,
                      loops > 0 ? `${loops} loops` : null,
                      tasks > 0 ? `${tasks} tasks` : null,
                      harness > 0 ? `${harness} harnesses` : null,
                      stubs > 0 ? `${stubs} stubs` : null,
                      astKind ? `AST: ${astKind}` : null,
                    ].filter(Boolean);
                    return parts.join(' · ');                  } catch {
                    return 'Invalid JSON';
                  }
                })()}
              </p>
            </div>

            <button
              onClick={handleReParse}
              disabled={reparsing}
              className="p-1.5 rounded transition-colors"
              style={{ color: reparsing ? '#facc15' : '#52525b' }}
              title="Re-parse with latest analyzer (gets fresh types, no duplicates)"
              onMouseEnter={(e) => { if (!reparsing) (e.currentTarget as HTMLButtonElement).style.color = '#facc15'; }}
              onMouseLeave={(e) => { if (!reparsing) (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
            >
              {reparsing ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>

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

          {/* Stale JSON warning — shown when TRUE duplicates detected (same name + same line) */}
          {isStaleJson && (
            <div
              className="flex items-center gap-2 px-3 py-2 flex-shrink-0 text-[10px] font-mono"
              style={{ background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}
            >
              <AlertCircle size={12} className="flex-shrink-0" />
              <span className="flex-1">Stale data — duplicate subprograms at same line. Re-parse to get fresh analysis.</span>
              <button
                onClick={handleReParse}
                disabled={reparsing}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b', cursor: reparsing ? 'not-allowed' : 'pointer' }}
              >
                {reparsing ? <Loader size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                {reparsing ? 'Re-parsing...' : 'Re-parse now'}
              </button>
            </div>
          )}

          {/* Spec-only info — shown when .ads file has no variables/control flow data */}
          {!isStaleJson && activeResult && (() => {
            try {
              const d = JSON.parse(activeResult.jsonText);
              const fp = d.file_paths?.[0] ?? '';
              const isSpecOnly = fp.endsWith('.ads');
              const hasVars = (d.variables_info?.[fp]?.locals?.length ?? 0) > 0 ||
                              (d.variables_info?.[fp]?.locals?.length ?? -1) > -1;
              const hasCF = Object.keys(d.control_flow_extractor?.[fp] ?? {}).length > 0;
              if (isSpecOnly && !hasCF) {
                return (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 text-[10px] font-mono"
                    style={{ background: 'rgba(96,165,250,0.06)', borderBottom: '1px solid rgba(96,165,250,0.15)', color: '#93c5fd' }}
                  >
                    <span style={{ fontSize: 11 }}>ℹ</span>
                    <span>Spec file (.ads) — upload the matching .adb body file too for variables &amp; control flow data</span>
                  </div>
                );
              }
            } catch { /* ignore */ }
            return null;
          })()}

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
            {/* Backend harness button — only shown when test_harness_data is available */}
            {(() => {
              try {
                const d = JSON.parse(activeResult.jsonText) as import('../../utils/adaAnalyzer').AdaAnalysisResult;
                const harnessEntries = Object.values(d.test_harness_data ?? {}).flat();
                if (harnessEntries.length === 0) return null;
                return (
                  <button
                    onClick={() => {
                      // Load backend harness templates as test cases via generateTests
                      const subs = subprograms.filter((s) => s.fileId === activeResult.fileId);
                      subs.forEach((sub) => { generateTests(sub); });
                      setActiveTab('tests');
                      showToast(`Loaded ${harnessEntries.length} backend harness template(s)`, 'success');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-xs mb-2 transition-all"
                    style={{
                      background: 'rgba(74,222,128,0.08)',
                      color: '#4ade80',
                      border: '1px solid rgba(74,222,128,0.25)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,222,128,0.15)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,222,128,0.08)'; }}
                  >
                    🔧 Use Backend Harness ({harnessEntries.length} templates)
                  </button>
                );
              } catch { return null; }
            })()}
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
