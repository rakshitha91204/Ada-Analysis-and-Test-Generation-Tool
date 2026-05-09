import React from 'react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { Tooltip } from '../shared/Tooltip';

export const CoverageHeatmap: React.FC = () => {
  const { subprograms } = useSubprogramStore();
  const { currentTestSets } = useTestCaseStore();

  if (subprograms.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
    >
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
        Coverage by Subprogram
      </p>
      <div className="flex flex-col gap-2">
        {subprograms.map((sub) => {
          const tests = currentTestSets[sub.id] || [];
          const hasNormal = tests.some((t) => t.type === 'normal');
          const hasEdge = tests.some((t) => t.type === 'edge');
          const hasInvalid = tests.some((t) => t.type === 'invalid');
          const covered = [hasNormal, hasEdge, hasInvalid].filter(Boolean).length;
          const pct = Math.round((covered / 3) * 100);

          return (
            <div key={sub.id} className="flex items-center gap-3">
              <span className="text-xs font-mono text-zinc-400 w-20 truncate flex-shrink-0">
                {sub.name}
              </span>

              {/* Type coverage dots */}
              <div className="flex items-center gap-1">
                {[
                  { label: 'Normal', has: hasNormal, color: '#22c55e' },
                  { label: 'Edge', has: hasEdge, color: '#f59e0b' },
                  { label: 'Invalid', has: hasInvalid, color: '#ef4444' },
                ].map((t) => (
                  <Tooltip key={t.label} content={`${t.label}: ${t.has ? '✓' : '✗'}`}>
                    <span
                      className="w-3 h-3 rounded-sm inline-block transition-all"
                      style={{
                        background: t.has ? t.color : 'var(--bg-hover)',
                        border: `1px solid ${t.has ? t.color : 'var(--border-default)'}`,
                        opacity: t.has ? 1 : 0.4,
                      }}
                    />
                  </Tooltip>
                ))}
              </div>

              {/* Progress bar */}
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? '#22c55e' : pct >= 66 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>

              <span className="text-[10px] font-mono text-zinc-600 w-8 text-right flex-shrink-0">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
        {[
          { color: '#22c55e', label: 'Normal' },
          { color: '#f59e0b', label: 'Edge' },
          { color: '#ef4444', label: 'Invalid' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1 text-[10px] font-mono text-zinc-600">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
};
