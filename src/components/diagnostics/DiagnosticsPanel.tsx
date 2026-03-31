import React, { useState } from 'react';
import { AlertTriangle, XCircle, Info, CheckCircle } from 'lucide-react';
import { mockDiagnostics, Diagnostic } from '../../mocks/mockDiagnostics';
import { EmptyState } from '../shared/EmptyState';
import { Badge } from '../shared/Badge';

const severityIcon = {
  error: <XCircle size={12} className="text-red-400 flex-shrink-0" />,
  warning: <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />,
  info: <Info size={12} className="text-blue-400 flex-shrink-0" />,
};

const severityBorder = {
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

const DiagRow: React.FC<{ diag: Diagnostic; isNew?: boolean }> = ({ diag, isNew }) => {
  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2 border-b border-l-2 cursor-pointer hover:bg-zinc-800/30 transition-colors ${severityBorder[diag.severity]} ${isNew ? 'amber-pulse' : ''}`}
      style={{ borderBottomColor: 'var(--border-default)' }}
      title={`${diag.file}:${diag.line}:${diag.column}`}
    >
      {severityIcon[diag.severity]}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 leading-snug">{diag.message}</p>
        <p className="text-[10px] font-mono text-zinc-600 mt-0.5">
          {diag.file}:{diag.line}:{diag.column}
        </p>
      </div>
    </div>
  );
};

export const DiagnosticsPanel: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const diagnostics = mockDiagnostics;

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  const filtered = filter === 'all' ? diagnostics : diagnostics.filter((d) => d.severity === filter);

  if (diagnostics.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle size={24} className="text-green-400" />}
        heading="✓ No issues detected in this file."
        subtext="Static analysis found no errors or warnings."
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
        {[
          { id: 'all' as const, label: 'All', count: diagnostics.length },
          { id: 'error' as const, label: 'Errors', count: errors.length },
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
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={20} className="text-green-400" />}
            heading={`No ${filter}s`}
          />
        ) : (
          filtered.map((d) => <DiagRow key={d.id} diag={d} />)
        )}
      </div>
    </div>
  );
};
