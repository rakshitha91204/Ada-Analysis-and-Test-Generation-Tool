import React, { useState } from 'react';
import {
  AlertTriangle, Code2, BarChart2, ChevronRight, Clock,
  Zap, Shield, Activity, RefreshCw, Database,
} from 'lucide-react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useParseStore } from '../../store/useParseStore';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { mockDiagnostics } from '../../mocks/mockDiagnostics';
import { format } from 'date-fns';

interface AnalysisOutputProps {
  compact?: boolean;
}

const complexityColor = (score: number) => {
  if (score <= 2) return { bar: '#22c55e', text: 'text-green-400', label: 'Low' };
  if (score <= 5) return { bar: '#f59e0b', text: 'text-amber-400', label: 'Med' };
  return { bar: '#ef4444', text: 'text-red-400', label: 'High' };
};

export const AnalysisOutput: React.FC<AnalysisOutputProps> = ({ compact = false }) => {
  const { setActiveTab, navigateTo } = useEditorStore();
  const { subprograms } = useSubprogramStore();
  const { results, activeResultFileId } = useParseStore();
  const { files, activeFileId } = useFileStore();
  const [lastRun] = useState(new Date());
  const [varsTab, setVarsTab] = useState<'locals' | 'globals' | 'params' | 'usage'>('locals');

  // Resolve active analysis result
  const activeResult = activeResultFileId
    ? results[activeResultFileId]
    : activeFileId
    ? results[activeFileId]
    : null;

  const analysis = activeResult?.analysis;
  const hasBackendData = !!analysis;

  // ── Dead code — only keep string entries ──────────────────────────────────
  const rawDeadCode = analysis?.dead_code ?? [];
  const deadCode: string[] = rawDeadCode.filter((x: unknown) => typeof x === 'string') as string[];

  // ── Logical errors ─────────────────────────────────────────────────────────
  const logicalErrors: string[] = analysis?.logical_errors ?? [];

  // ── Performance warnings ───────────────────────────────────────────────────
  const perfWarnings: string[] = analysis?.performance_warnings ?? [];

  // ── Cyclomatic complexity — only keep numeric entries ─────────────────────
  const complexityMap: Record<string, number> = {};
  for (const [k, v] of Object.entries(analysis?.cyclomatic_complexity ?? {})) {
    if (typeof v === 'number') complexityMap[k] = v;
  }

  // ── Loop & exception info — only keep numeric entries ─────────────────────
  const loopInfo: Record<string, number> = {};
  for (const [k, v] of Object.entries(analysis?.loop_info ?? {})) {
    if (typeof v === 'number') loopInfo[k] = v;
  }
  const exceptionsInfo: Record<string, number> = {};
  for (const [k, v] of Object.entries(analysis?.exceptions_info ?? {})) {
    if (typeof v === 'number') exceptionsInfo[k] = v;
  }

  // ── Concurrency ────────────────────────────────────────────────────────────
  const tasks: string[] = analysis?.concurrency_info?.tasks ?? [];
  const protectedObjects: string[] = analysis?.protected_objects ?? [];

  // ── Variables summary (new schema + legacy fallback) ──────────────────────
  const filePath = analysis?.file_paths?.[0] ?? '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const varFileInfo: any = analysis?.variables_info?.[filePath] ?? {};
  // New schema
  const varGlobals: Array<{ name: string; type: string; line: number; is_constant: boolean }> =
    varFileInfo.globals ?? [];
  const varLocals: Array<{ name: string; type: string; line: number; subprogram: string }> =
    varFileInfo.locals ?? [];
  const varParams: Array<{ name: string; type: string; mode: string; line: number; subprogram: string }> =
    varFileInfo.parameters ?? [];
  const varSummary = varFileInfo.summary ?? {};
  const varGlobalUsage: Record<string, { reads: string[]; writes: string[] }> =
    varFileInfo.global_usage ?? {};

  // Legacy fallback counts
  const localVarsCount: number = varSummary.total_locals ??
    Object.values((varFileInfo.local_variables ?? {}) as Record<string, Record<string, unknown>>).reduce((a: number, v) => a + Object.keys(v).length, 0);
  const globalVarsCount: number = varSummary.total_globals ??
    Object.values((varFileInfo.global_variables ?? {}) as Record<string, Record<string, unknown>>).reduce((a: number, v) => a + Object.keys(v).length, 0);
  const constantsCount: number = varSummary.total_constants ?? 0;
  const paramsCount: number = varSummary.total_params ?? varParams.length;

  // ── Global read/write (new schema: read_by/write_by maps) ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalRWData: any = analysis?.global_read_write?.[filePath] ?? {};
  // New schema
  const readByMap: Record<string, string[]> = globalRWData.read_by ?? {};
  const writeByMap: Record<string, string[]> = globalRWData.write_by ?? {};
  const globalsInfo: Record<string, { type?: string }> = globalRWData.globals ?? {};
  // Legacy fallback arrays
  const legacyRead: string[] = globalRWData.read ?? Object.keys(readByMap);
  const legacyWrite: string[] = globalRWData.write ?? Object.keys(writeByMap);
  const hasGlobalRW = Object.keys(readByMap).length > 0 || Object.keys(writeByMap).length > 0 || legacyRead.length > 0 || legacyWrite.length > 0;

  // ── Control flow summary ───────────────────────────────────────────────────
  const controlFlow = analysis?.control_flow_extractor?.[filePath] ?? {};
  const totalBranches = Object.values(controlFlow)
    .reduce((a, v) => a + (v.if_conditions?.length ?? 0), 0);
  const totalProcCalls = Object.values(controlFlow)
    .reduce((a, v) => a + (v.procedure_calls?.length ?? 0), 0);

  // Fall back to mock diagnostics when no backend data
  const unusedVarsMock = mockDiagnostics.filter((d) => d.message.toLowerCase().includes('unused'));
  const deadCodeMock = mockDiagnostics.filter((d) => d.message.toLowerCase().includes('unreachable'));

  const cardClass = 'rounded-xl border p-4';
  const cardStyle = { background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' };

  const navigateToFile = (line: number) => {
    const file = files.find((f) => f.id === activeFileId || f.id === activeResultFileId);
    if (file) {
      setActiveTab('code');
      setTimeout(() => navigateTo(line, file.id), 100);
    }
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col gap-3 p-3">{/* inner flex column */}
      {/* Header: source badge + timestamp */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
        <Clock size={10} />
        <span>
          {activeResult
            ? `Parsed: ${format(new Date(activeResult.parsedAt), 'MMM d, HH:mm:ss')}`
            : `Last run: ${format(lastRun, 'MMM d, HH:mm:ss')}`}
        </span>
        {hasBackendData && (
          <span
            className="ml-1 px-1.5 py-0.5 rounded text-[9px]"
            style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            libadalang ✓
          </span>
        )}
        {!hasBackendData && (
          <span
            className="ml-1 px-1.5 py-0.5 rounded text-[9px]"
            style={{ background: 'rgba(250,204,21,0.08)', color: '#facc15', border: '1px solid rgba(250,204,21,0.15)' }}
          >
            demo data
          </span>
        )}
      </div>

      {/* ── Subprogram Summary ─────────────────────────────────────────────── */}
      {(() => {
        // Build subprogram list from the active file's analysis data (most accurate)
        const subpIndex = analysis?.subprogram_index ?? {};
        // Flatten all entries from all file keys
        const allSubps = Object.values(subpIndex).flat() as Array<{
          name: string;
          return_type: string | null;
          is_function: boolean;
          start_line: number;
          end_line: number;
          parameters: string[];
        }>;
        const fileName = analysis?.file_paths?.[0] ?? activeResult?.fileName ?? '';
        const deadSet  = new Set<string>(analysis?.dead_code ?? []);

        // Determine functions vs procedures:
        // A subprogram is a function if is_function=true OR has a non-null return_type
        const dispFunctions  = allSubps.filter(s => s.is_function === true || (s.return_type != null && s.return_type !== ''));
        const dispProcedures = allSubps.filter(s => !(s.is_function === true || (s.return_type != null && s.return_type !== '')));

        // Fallback to subprogram store when no backend data
        const fallbackSubps = subprograms.map(s => ({
          name: s.name,
          return_type: s.returnType ?? null,
          is_function: s.kind === 'function',
          start_line: s.startLine ?? 0,
          end_line: s.endLine ?? 0,
          parameters: [],
        }));
        const displaySubps   = allSubps.length > 0 ? allSubps : fallbackSubps;
        const displayFuncs   = displaySubps.filter(s => s.is_function === true || (s.return_type != null && s.return_type !== ''));
        const displayProcs   = displaySubps.filter(s => !(s.is_function === true || (s.return_type != null && s.return_type !== '')));

        if (displaySubps.length === 0 && !hasBackendData) return null;

        return (
          <div className={cardClass} style={{ ...cardStyle, borderColor: 'rgba(167,139,250,0.2)' }}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 13, color: '#a78bfa' }}>⬛</span>
              <span className="text-xs font-mono font-semibold text-zinc-300">Subprogram Summary</span>
              <span className="ml-auto text-[10px] font-mono" style={{ color: '#a78bfa' }}>
                {displaySubps.length} total
              </span>
            </div>

            {/* File name */}
            {fileName && (
              <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded"
                style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
                <span style={{ fontSize: 10 }}>📄</span>
                <span className="text-[10px] font-mono text-zinc-400 truncate" title={fileName}>{fileName}</span>
              </div>
            )}

            {/* Totals grid */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Total',      value: displaySubps.length,  color: '#e4e4e7', bg: 'rgba(255,255,255,0.05)' },
                { label: 'Functions',  value: displayFuncs.length,  color: '#fb923c', bg: 'rgba(251,146,60,0.08)' },
                { label: 'Procedures', value: displayProcs.length,  color: '#facc15', bg: 'rgba(250,204,21,0.08)' },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center py-2 rounded"
                  style={{ background: item.bg, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-lg font-mono font-bold" style={{ color: item.color }}>{item.value}</span>
                  <span className="text-[9px] font-mono text-zinc-600 mt-0.5">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Functions list */}
            {displayFuncs.length > 0 && (
              <div className="mb-2">
                <p className="text-[9px] font-mono uppercase tracking-wider mb-1.5" style={{ color: '#fb923c' }}>
                  Functions ({displayFuncs.length})
                </p>
                <div className="flex flex-col gap-0.5">
                  {displayFuncs.map((s, i) => (
                    <div key={i}
                      onClick={() => s.start_line && navigateToFile(s.start_line)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
                      style={{ background: 'rgba(251,146,60,0.04)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(251,146,60,0.1)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(251,146,60,0.04)'; }}
                    >
                      <span className="text-[11px] font-mono flex-shrink-0" style={{ color: '#fb923c' }}>ƒ</span>
                      <span className="text-[11px] font-mono font-semibold flex-1 min-w-0 truncate"
                        style={{ color: '#e4e4e7' }} title={s.name}>{s.name}</span>
                      {s.return_type && (
                        <span className="text-[9px] font-mono px-1 rounded flex-shrink-0"
                          style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>
                          → {s.return_type}
                        </span>
                      )}
                      {(s.parameters?.length ?? 0) > 0 && (
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: '#52525b' }}>
                          {s.parameters!.length}p
                        </span>
                      )}
                      {deadSet.has(s.name) && (
                        <span className="text-[8px] font-mono px-1 rounded flex-shrink-0"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>dead</span>
                      )}
                      {s.start_line > 0 && (
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: '#52525b' }}>
                          L{s.start_line}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Procedures list */}
            {displayProcs.length > 0 && (
              <div>
                <p className="text-[9px] font-mono uppercase tracking-wider mb-1.5" style={{ color: '#facc15' }}>
                  Procedures ({displayProcs.length})
                </p>
                <div className="flex flex-col gap-0.5">
                  {displayProcs.map((s, i) => (
                    <div key={i}
                      onClick={() => s.start_line && navigateToFile(s.start_line)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
                      style={{ background: 'rgba(250,204,21,0.03)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(250,204,21,0.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(250,204,21,0.03)'; }}
                    >
                      <span className="text-[11px] font-mono flex-shrink-0" style={{ color: '#facc15' }}>⚡</span>
                      <span className="text-[11px] font-mono font-semibold flex-1 min-w-0 truncate"
                        style={{ color: '#e4e4e7' }} title={s.name}>{s.name}</span>
                      {(s.parameters?.length ?? 0) > 0 && (
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: '#52525b' }}>
                          {s.parameters!.length} param{s.parameters!.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {deadSet.has(s.name) && (
                        <span className="text-[8px] font-mono px-1 rounded flex-shrink-0"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>dead</span>
                      )}
                      {s.start_line > 0 && (
                        <span className="text-[9px] font-mono flex-shrink-0" style={{ color: '#52525b' }}>
                          L{s.start_line}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {displaySubps.length === 0 && (
              <p className="text-[10px] font-mono text-zinc-600">No subprograms found — click ⬛ Analyse on a .adb file first</p>
            )}
          </div>
        );
      })()}

      {/* ── Dead Code ──────────────────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center gap-2 mb-2">
          <Code2 size={13} className="text-red-400" />
          <span className="text-xs font-mono font-semibold text-zinc-300">Dead Code</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">
            {hasBackendData ? deadCode.length : deadCodeMock.length} found
          </span>
        </div>
        {hasBackendData ? (
          deadCode.length === 0 ? (
            <p className="text-xs text-zinc-600 font-mono">None detected</p>
          ) : (
            deadCode.map((name, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-700/30 transition-colors">
                <ChevronRight size={10} className="text-red-400 flex-shrink-0" />
                <span className="text-xs font-mono text-zinc-400">{name}</span>
                <span className="text-[9px] font-mono text-zinc-600 ml-auto">unused subprogram</span>
              </div>
            ))
          )
        ) : (
          deadCodeMock.map((d) => (
            <div key={d.id} onClick={() => setActiveTab('code')}
              className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-zinc-700/30 rounded px-1 transition-colors group">
              <ChevronRight size={10} className="text-zinc-600 group-hover:text-red-400 transition-colors" />
              <span className="text-xs font-mono text-zinc-400 flex-1 truncate">{d.message}</span>
              <span className="text-[10px] font-mono text-zinc-600">{d.file}:{d.line}</span>
            </div>
          ))
        )}
      </div>

      {/* ── Bug Report — REMOVED ─────────────────────────────────────────── */}

      {/* ── Logical Errors ─────────────────────────────────────────────────── */}
      {hasBackendData && (logicalErrors.length > 0 || perfWarnings.length > 0) && (
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} className="text-amber-400" />
            <span className="text-xs font-mono font-semibold text-zinc-300">Warnings</span>
            <span className="ml-auto text-[10px] font-mono text-zinc-600">
              {logicalErrors.length + perfWarnings.length} found
            </span>
          </div>
          {[...logicalErrors, ...perfWarnings].map((msg, i) => (
            <div key={i} className="flex items-center gap-2 py-1 px-1 rounded">
              <ChevronRight size={10} className="text-amber-400 flex-shrink-0" />
              <span className="text-xs font-mono text-zinc-400">{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Unused Variables (mock fallback) ───────────────────────────────── */}
      {!hasBackendData && (
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} className="text-amber-400" />
            <span className="text-xs font-mono font-semibold text-zinc-300">Unused Variables</span>
            <span className="ml-auto text-[10px] font-mono text-zinc-600">{unusedVarsMock.length} found</span>
          </div>
          {unusedVarsMock.map((d) => (
            <div key={d.id} onClick={() => setActiveTab('code')}
              className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-zinc-700/30 rounded px-1 transition-colors group">
              <ChevronRight size={10} className="text-zinc-600 group-hover:text-amber-400 transition-colors" />
              <span className="text-xs font-mono text-zinc-400 flex-1 truncate">{d.message}</span>
              <span className="text-[10px] font-mono text-zinc-600">{d.file}:{d.line}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Cyclomatic Complexity ───────────────────────────────────────────── */}
      <div className={cardClass} style={cardStyle}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-blue-400" />
          <span className="text-xs font-mono font-semibold text-zinc-300">Cyclomatic Complexity</span>
        </div>
        <div className="flex flex-col gap-2">
          {hasBackendData && Object.keys(complexityMap).length > 0 ? (
            Object.entries(complexityMap).map(([name, score]) => {
              const { bar, text, label } = complexityColor(score);
              return (
                <div key={name} className="flex items-center gap-3 group/row relative">
                  {/* Name — truncated in layout but full name shown in tooltip popup on hover */}
                  <div className="relative flex-shrink-0 w-28">
                    <span
                      className="block text-xs font-mono text-zinc-400 overflow-hidden"
                      style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {name}
                    </span>
                    {/* Tooltip — full name, appears above on hover */}
                    <div
                      className="absolute bottom-full left-0 mb-1 px-2 py-1 rounded text-[10px] font-mono text-zinc-100 pointer-events-none z-50
                                 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150"
                      style={{
                        background: '#18181b',
                        border: '1px solid rgba(250,204,21,0.3)',
                        whiteSpace: 'nowrap',
                        maxWidth: '260px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      }}
                    >
                      {name}
                    </div>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min((score / 10) * 100, 100)}%`, background: bar }} />
                  </div>
                  <span className={`text-[10px] font-mono font-bold w-5 text-right flex-shrink-0 ${text}`}>{score}</span>
                  <span className={`text-[9px] font-mono w-8 flex-shrink-0 ${text}`}>{label}</span>
                </div>
              );
            })
          ) : (
            subprograms.map((sub) => {
              const score = complexityMap[sub.name] ?? 2;
              const { bar, text, label } = complexityColor(score);
              return (
                <div key={sub.id} className="flex items-center gap-3 group/row relative">
                  <div className="relative flex-shrink-0 w-28">
                    <span
                      className="block text-xs font-mono text-zinc-400 overflow-hidden"
                      style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {sub.name}
                    </span>
                    <div
                      className="absolute bottom-full left-0 mb-1 px-2 py-1 rounded text-[10px] font-mono text-zinc-100 pointer-events-none z-50
                                 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150"
                      style={{
                        background: '#18181b',
                        border: '1px solid rgba(250,204,21,0.3)',
                        whiteSpace: 'nowrap',
                        maxWidth: '260px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      }}
                    >
                      {sub.name}
                    </div>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min((score / 10) * 100, 100)}%`, background: bar }} />
                  </div>
                  <span className={`text-[10px] font-mono font-bold w-5 text-right flex-shrink-0 ${text}`}>{score}</span>
                  <span className={`text-[9px] font-mono w-8 flex-shrink-0 ${text}`}>{label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Concurrency & Protected Objects ────────────────────────────────── */}
      {hasBackendData && (tasks.length > 0 || protectedObjects.length > 0) && (
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Activity size={13} className="text-purple-400" />
            <span className="text-xs font-mono font-semibold text-zinc-300">Concurrency</span>
          </div>
          {tasks.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-mono text-zinc-500 mb-1">Tasks ({tasks.length})</p>
              {tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5 px-1">
                  <ChevronRight size={10} className="text-purple-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-zinc-400">{t}</span>
                </div>
              ))}
            </div>
          )}
          {protectedObjects.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-zinc-500 mb-1">Protected Objects ({protectedObjects.length})</p>
              {protectedObjects.map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5 px-1">
                  <Shield size={10} className="text-blue-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-zinc-400">{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Variables Summary ───────────────────────────────────────────────── */}
      {hasBackendData && (localVarsCount > 0 || globalVarsCount > 0 || paramsCount > 0) && (
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} className="text-amber-400" />
            <span className="text-xs font-mono font-semibold text-zinc-300">Variables</span>
          </div>
          {/* Summary counts */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: 'Globals', value: globalVarsCount, color: 'text-amber-400' },
              { label: 'Locals', value: localVarsCount, color: 'text-zinc-300' },
              { label: 'Params', value: paramsCount, color: 'text-blue-400' },
              { label: 'Constants', value: constantsCount, color: 'text-green-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-2 py-1.5 rounded bg-zinc-800/40">
                <span className="text-[10px] font-mono text-zinc-500">{item.label}</span>
                <span className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mb-2">
            {(['locals', 'globals', 'params', 'usage'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setVarsTab(tab)}
                className="px-2 py-0.5 rounded text-[9px] font-mono transition-colors"
                style={{
                  background: varsTab === tab ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                  color: varsTab === tab ? '#fbbf24' : '#71717a',
                  border: varsTab === tab ? '1px solid rgba(251,191,36,0.3)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Tab content */}
          <div className="max-h-48 overflow-y-auto">
            {varsTab === 'locals' && varLocals.map((v, i) => (
              <div key={i}
                onClick={() => v.line && navigateToFile(v.line)}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-700/30 cursor-pointer transition-colors">
                <ChevronRight size={9} className="text-zinc-500 flex-shrink-0" />
                <span className="text-[10px] font-mono text-zinc-300 font-semibold">{v.name}</span>
                <span className="text-[9px] font-mono text-zinc-500 flex-1 truncate">{v.type}</span>
                <span className="text-[9px] font-mono text-zinc-600">{v.subprogram}</span>
                {v.line > 0 && <span className="text-[9px] font-mono text-zinc-700">:{v.line}</span>}
              </div>
            ))}
            {varsTab === 'globals' && varGlobals.map((v, i) => (
              <div key={i}
                onClick={() => v.line && navigateToFile(v.line)}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-700/30 cursor-pointer transition-colors">
                <ChevronRight size={9} className={`flex-shrink-0 ${v.is_constant ? 'text-green-500' : 'text-amber-500'}`} />
                <span className="text-[10px] font-mono text-zinc-300 font-semibold">{v.name}</span>
                <span className="text-[9px] font-mono text-zinc-500 flex-1 truncate">{v.type}</span>
                {v.is_constant && (
                  <span className="text-[8px] font-mono px-1 rounded"
                    style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>const</span>
                )}
                {v.line > 0 && <span className="text-[9px] font-mono text-zinc-700">:{v.line}</span>}
              </div>
            ))}
            {varsTab === 'params' && varParams.map((v, i) => (
              <div key={i}
                onClick={() => v.line && navigateToFile(v.line)}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-zinc-700/30 cursor-pointer transition-colors">
                <ChevronRight size={9} className="text-blue-500 flex-shrink-0" />
                <span className="text-[10px] font-mono text-zinc-300 font-semibold">{v.name}</span>
                <span className="text-[9px] font-mono text-blue-400 px-1 rounded"
                  style={{ background: 'rgba(96,165,250,0.1)' }}>{v.mode}</span>
                <span className="text-[9px] font-mono text-zinc-500 flex-1 truncate">{v.type}</span>
                <span className="text-[9px] font-mono text-zinc-600">{v.subprogram}</span>
              </div>
            ))}
            {varsTab === 'usage' && Object.entries(varGlobalUsage).map(([subp, usage]) => (
              <div key={subp} className="mb-2">
                <p className="text-[9px] font-mono text-zinc-500 mb-1 px-1">{subp}</p>
                {usage.reads.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1 mb-1">
                    <span className="text-[8px] font-mono text-blue-400">reads:</span>
                    {usage.reads.map((r, i) => (
                      <span key={i} className="text-[8px] font-mono px-1 rounded"
                        style={{ background: 'rgba(96,165,250,0.1)', color: '#93c5fd' }}>{r}</span>
                    ))}
                  </div>
                )}
                {usage.writes.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    <span className="text-[8px] font-mono text-red-400">writes:</span>
                    {usage.writes.map((w, i) => (
                      <span key={i} className="text-[8px] font-mono px-1 rounded"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{w}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {varsTab === 'usage' && Object.keys(varGlobalUsage).length === 0 && (
              <p className="text-[10px] font-mono text-zinc-600 px-1">No global usage data</p>
            )}
          </div>
        </div>
      )}

      {/* ── Global Read / Write ─────────────────────────────────────────────── */}
      {hasBackendData && hasGlobalRW && (
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={13} className="text-cyan-400" />
            <span className="text-xs font-mono font-semibold text-zinc-300">Global Read / Write</span>
            <Database size={11} className="text-zinc-600 ml-auto" />
          </div>
          {/* Written globals */}
          {(Object.keys(writeByMap).length > 0 || legacyWrite.length > 0) && (
            <div className="mb-3">
              <p className="text-[10px] font-mono text-red-400 mb-1">
                Written ({Object.keys(writeByMap).length || legacyWrite.length})
              </p>
              {Object.keys(writeByMap).length > 0
                ? Object.entries(writeByMap).map(([varName, subps]) => (
                    <div key={varName} className="mb-1.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono font-semibold text-red-300">{varName}</span>
                        {globalsInfo[varName]?.type && (
                          <span className="text-[9px] font-mono text-zinc-600">{globalsInfo[varName].type}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 pl-2">
                        {subps.map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[8px] font-mono"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                : (
                  <div className="flex flex-wrap gap-1">
                    {legacyWrite.map((v, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {v}
                      </span>
                    ))}
                  </div>
                )
              }
            </div>
          )}
          {/* Read globals */}
          {(Object.keys(readByMap).length > 0 || legacyRead.length > 0) && (
            <div>
              <p className="text-[10px] font-mono text-blue-400 mb-1">
                Read ({Object.keys(readByMap).length || legacyRead.length})
              </p>
              {Object.keys(readByMap).length > 0
                ? Object.entries(readByMap).map(([varName, subps]) => (
                    <div key={varName} className="mb-1.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono font-semibold text-blue-300">{varName}</span>
                        {globalsInfo[varName]?.type && (
                          <span className="text-[9px] font-mono text-zinc-600">{globalsInfo[varName].type}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 pl-2">
                        {subps.map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[8px] font-mono"
                            style={{ background: 'rgba(96,165,250,0.08)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                : (
                  <div className="flex flex-wrap gap-1">
                    {legacyRead.map((v, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                        style={{ background: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)' }}>
                        {v}
                      </span>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </div>
      )}

      {/* ── Control Flow Summary ────────────────────────────────────────────── */}
      {hasBackendData && (totalBranches > 0 || totalProcCalls > 0) && (
        <div className={cardClass} style={cardStyle}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={13} className="text-indigo-400" />
            <span className="text-xs font-mono font-semibold text-zinc-300">Control Flow</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-zinc-800/40">
              <span className="text-[10px] font-mono text-zinc-500">Branch conditions</span>
              <span className="text-sm font-mono font-bold text-indigo-400">{totalBranches}</span>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 rounded bg-zinc-800/40">
              <span className="text-[10px] font-mono text-zinc-500">Procedure calls</span>
              <span className="text-sm font-mono font-bold text-violet-400">{totalProcCalls}</span>
            </div>
          </div>
          {Object.entries(controlFlow).slice(0, 4).map(([subName, cf]) => (
            cf.if_conditions && cf.if_conditions.length > 0 ? (
              <div key={subName} className="mb-1">
                <p className="text-[9px] font-mono text-zinc-600 mb-0.5">{subName}</p>
                {cf.if_conditions.slice(0, 2).map((cond, i) => (
                  <div key={i} className="flex items-center gap-1 py-0.5 px-1">
                    <span className="text-[9px] font-mono px-1 rounded"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }}>
                      {cond.branch_type}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 truncate">{cond.condition_text}</span>
                  </div>
                ))}
              </div>
            ) : null
          ))}
        </div>
      )}

      </div>{/* end inner flex column */}
    </div>
  );
};
