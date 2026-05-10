import React, { useMemo, useState } from 'react';
import { AlertTriangle, XCircle, Info, CheckCircle } from 'lucide-react';
import { mockDiagnostics, Diagnostic } from '../../mocks/mockDiagnostics';
import { EmptyState } from '../shared/EmptyState';
import { Badge } from '../shared/Badge';
import { useEditorStore } from '../../store/useEditorStore';
import { useFileStore } from '../../store/useFileStore';
import { useParseStore } from '../../store/useParseStore';
import { BugEntry } from '../../utils/adaAnalyzer';

const severityIcon = {
  error:   <XCircle size={12} className="text-red-400 flex-shrink-0" />,
  warning: <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />,
  info:    <Info size={12} className="text-blue-400 flex-shrink-0" />,
};

const severityBorder = {
  error:   'border-l-red-500',
  warning: 'border-l-amber-500',
  info:    'border-l-blue-500',
};

const DiagRow: React.FC<{ diag: Diagnostic }> = ({ diag }) => {
  const { setActiveTab, navigateTo, openTab } = useEditorStore();
  const { files, setActiveFile } = useFileStore();

  const handleClick = () => {
    const file = files.find((f) => f.name === diag.file);
    if (file) {
      setActiveFile(file.id);
      openTab(file.id);
      setActiveTab('code');
      setTimeout(() => navigateTo(diag.line, file.id), 200);
    } else {
      setActiveTab('code');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-start gap-2.5 px-3 py-2 border-b border-l-2 cursor-pointer hover:bg-zinc-800/30 transition-colors ${severityBorder[diag.severity]}`}
      style={{ borderBottomColor: 'var(--border-default)' }}
      title={`Click to jump to ${diag.file}:${diag.line}:${diag.column}`}
    >
      {severityIcon[diag.severity]}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 leading-snug">{diag.message}</p>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: '#facc15' }}>
          {diag.file}:{diag.line}:{diag.column}
          <span className="ml-2 text-zinc-600">↗ click to navigate</span>
        </p>
      </div>
    </div>
  );
};

/**
 * Convert backend BugEntry items into Diagnostic rows.
 */
function bugEntriesToDiagnostics(
  entries: BugEntry[],
  severity: Diagnostic['severity'],
  messagePrefix: string
): Diagnostic[] {
  return entries.map((b, i) => ({
    id: `bug_${messagePrefix}_${i}`,
    severity,
    message: `${messagePrefix}: ${b.expression ?? b.statement ?? b.note ?? 'detected'}`,
    file: b.file.split(/[\\/]/).pop() ?? b.file,
    line: b.line,
    column: 1,
  }));
}

export const DiagnosticsPanel: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const { results, activeResultFileId } = useParseStore();
  const { activeFileId } = useFileStore();

  // Resolve active analysis
  const activeResult = activeResultFileId
    ? results[activeResultFileId]
    : activeFileId
    ? results[activeFileId]
    : null;

  const analysis = activeResult?.analysis;

  // Build diagnostics from backend data when available
  const diagnostics: Diagnostic[] = useMemo(() => {
    if (!analysis) return mockDiagnostics;

    const diags: Diagnostic[] = [];

    // Bug report → errors / warnings
    const bugReport = analysis.bug_report;
    if (bugReport) {
      diags.push(...bugEntriesToDiagnostics(bugReport.division_by_zero, 'error', 'Division by zero'));
      diags.push(...bugEntriesToDiagnostics(bugReport.null_dereference, 'warning', 'Null dereference'));
      diags.push(...bugEntriesToDiagnostics(bugReport.infinite_loops, 'warning', 'Infinite loop'));
      diags.push(...bugEntriesToDiagnostics(bugReport.unreachable_code, 'warning', 'Unreachable code'));
    }

    // Logical errors → errors
    const fileName = analysis.file_paths?.[0]?.split(/[\\/]/).pop() ?? 'unknown';
    (analysis.logical_errors ?? []).forEach((msg, i) => {
      diags.push({
        id: `logical_${i}`,
        severity: 'error',
        message: msg,
        file: fileName,
        line: 0,
        column: 0,
      });
    });

    // Performance warnings → info
    (analysis.performance_warnings ?? []).forEach((msg, i) => {
      diags.push({
        id: `perf_${i}`,
        severity: 'info',
        message: msg,
        file: fileName,
        line: 0,
        column: 0,
      });
    });

    // Dead code → warnings
    (analysis.dead_code ?? []).forEach((name, i) => {
      diags.push({
        id: `dead_${i}`,
        severity: 'warning',
        message: `Dead code: subprogram "${name}" is never called`,
        file: fileName,
        line: 0,
        column: 0,
      });
    });

    // If backend returned no issues, show a clean state
    return diags;
  }, [analysis]);

  const hasBackendData = !!analysis;
  const errors   = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const filtered = filter === 'all' ? diagnostics : diagnostics.filter((d) => d.severity === filter);

  if (diagnostics.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {hasBackendData && (
          <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              libadalang ✓
            </span>
          </div>
        )}
        <EmptyState
          icon={<CheckCircle size={24} className="text-green-400" />}
          heading="✓ No issues detected."
          subtext={hasBackendData ? 'libadalang found no errors or warnings.' : 'Static analysis found no errors or warnings.'}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
        {[
          { id: 'all' as const,     label: 'All',      count: diagnostics.length },
          { id: 'error' as const,   label: 'Errors',   count: errors.length },
          { id: 'warning' as const, label: 'Warnings', count: warnings.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
              filter === tab.id ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
            <Badge variant={tab.id === 'error' ? 'danger' : tab.id === 'warning' ? 'primary' : 'muted'}>
              {tab.count}
            </Badge>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {hasBackendData && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              libadalang ✓
            </span>
          )}
          <span className="text-[10px] font-mono text-zinc-600">click row to navigate</span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={<CheckCircle size={20} className="text-green-400" />} heading={`No ${filter}s`} />
        ) : (
          filtered.map((d) => <DiagRow key={d.id} diag={d} />)
        )}
      </div>
    </div>
  );
};
