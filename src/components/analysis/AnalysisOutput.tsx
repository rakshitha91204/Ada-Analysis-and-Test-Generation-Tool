import React, { useState } from 'react';
import { AlertTriangle, Code2, BarChart2, ChevronRight, Clock, RefreshCw } from 'lucide-react';
import { mockDiagnostics } from '../../mocks/mockDiagnostics';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { format } from 'date-fns';

interface AnalysisOutputProps {
  compact?: boolean;
}

const complexityScore = (name: string): number => {
  const map: Record<string, number> = { Add: 1, Subtract: 1, Multiply: 2, Divide: 3 };
  return map[name] ?? 2;
};

const complexityLabel = (score: number) => {
  if (score <= 2) return { text: 'Low', color: 'text-green-400' };
  if (score <= 4) return { text: 'Medium', color: 'text-amber-400' };
  return { text: 'High', color: 'text-red-400' };
};

export const AnalysisOutput: React.FC<AnalysisOutputProps> = ({ compact = false }) => {
  const { setActiveTab } = useEditorStore();
  const { subprograms } = useSubprogramStore();
  const [lastRun] = useState(new Date());

  const unusedVars = mockDiagnostics.filter((d) => d.message.toLowerCase().includes('unused'));
  const deadCode = mockDiagnostics.filter((d) => d.message.toLowerCase().includes('unreachable'));

  const cardClass = 'rounded-xl border p-4';

  return (
    <div className="flex flex-col gap-3 p-3" style={{ background: 'var(--bg-base)' }}>
      {/* Last run timestamp */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
        <Clock size={10} />
        <span>Last analysis: {format(lastRun, 'MMM d, HH:mm:ss')}</span>
        <button className="ml-auto flex items-center gap-1 text-zinc-600 hover:text-amber-400 transition-colors">
          <RefreshCw size={10} /> Re-run
        </button>
      </div>

      {/* Unused Variables */}
      <div className={cardClass} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={13} className="text-amber-400" />
          <span className="text-xs font-mono font-semibold text-zinc-300">Unused Variables</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">{unusedVars.length} found</span>
        </div>
        {unusedVars.length === 0 ? (
          <p className="text-xs text-zinc-600 font-mono">None detected</p>
        ) : (
          unusedVars.map((d) => (
            <div
              key={d.id}
              onClick={() => setActiveTab('code')}
              className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-zinc-700/30 rounded px-1 transition-colors group"
            >
              <ChevronRight size={10} className="text-zinc-600 group-hover:text-amber-400 transition-colors" />
              <span className="text-xs font-mono text-zinc-400 flex-1 truncate">{d.message}</span>
              <span className="text-[10px] font-mono text-zinc-600 hover:text-amber-400">{d.file}:{d.line}</span>
            </div>
          ))
        )}
      </div>

      {/* Dead Code */}
      <div className={cardClass} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Code2 size={13} className="text-red-400" />
          <span className="text-xs font-mono font-semibold text-zinc-300">Dead Code</span>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">{deadCode.length} found</span>
        </div>
        {deadCode.length === 0 ? (
          <p className="text-xs text-zinc-600 font-mono">None detected</p>
        ) : (
          deadCode.map((d) => (
            <div
              key={d.id}
              onClick={() => setActiveTab('code')}
              className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-zinc-700/30 rounded px-1 transition-colors group"
            >
              <ChevronRight size={10} className="text-zinc-600 group-hover:text-red-400 transition-colors" />
              <span className="text-xs font-mono text-zinc-400 flex-1 truncate">{d.message}</span>
              <span className="text-[10px] font-mono text-zinc-600">{d.file}:{d.line}</span>
            </div>
          ))
        )}
      </div>

      {/* Cyclomatic Complexity */}
      <div className={cardClass} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-blue-400" />
          <span className="text-xs font-mono font-semibold text-zinc-300">Cyclomatic Complexity</span>
        </div>
        <div className="flex flex-col gap-2">
          {(subprograms.length > 0 ? subprograms : []).map((sub) => {
            const score = complexityScore(sub.name);
            const { text, color } = complexityLabel(score);
            return (
              <div key={sub.id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-400 w-20 truncate flex-shrink-0">
                  {sub.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(score / 10) * 100}%`,
                      background: score <= 2 ? '#22c55e' : score <= 4 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <span className={`text-[10px] font-mono font-bold w-6 text-right flex-shrink-0 ${color}`}>{score}</span>
                <span className={`text-[9px] font-mono w-12 flex-shrink-0 ${color}`}>{text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subprogram dependency summary */}
      {!compact && subprograms.length > 0 && (
        <div className={cardClass} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 size={13} className="text-purple-400" />
            <span className="text-xs font-mono font-semibold text-zinc-300">Subprogram Summary</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Total', value: subprograms.length, color: 'text-zinc-300' },
              { label: 'Procedures', value: subprograms.filter((s) => s.kind === 'procedure').length, color: 'text-amber-400' },
              { label: 'Functions', value: subprograms.filter((s) => s.kind === 'function').length, color: 'text-orange-400' },
              { label: 'With Tests', value: subprograms.filter((s) => s.testCount > 0).length, color: 'text-green-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-2 py-1.5 rounded bg-zinc-800/40">
                <span className="text-[10px] font-mono text-zinc-500">{item.label}</span>
                <span className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
