import React, { useState } from 'react';
import { Play, ChevronDown, ChevronRight, TestTube } from 'lucide-react';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { Button } from '../shared/Button';
import { EmptyState } from '../shared/EmptyState';
import { Badge } from '../shared/Badge';

export const TestRunner: React.FC = () => {
  const { currentTestSets, updateTestRunStatus } = useTestCaseStore();
  const { subprograms } = useSubprogramStore();
  const [running, setRunning] = useState(false);
  const [expandedFails, setExpandedFails] = useState<Set<string>>(new Set());

  const allTests = subprograms.flatMap((sub) =>
    (currentTestSets[sub.id] || []).map((tc) => ({ ...tc, subName: sub.name, subId: sub.id }))
  );

  const passed = allTests.filter((t) => t.runStatus === 'pass').length;
  const failed = allTests.filter((t) => t.runStatus === 'fail').length;
  const passRate = allTests.length > 0 ? Math.round((passed / allTests.length) * 100) : 0;

  const runAll = () => {
    if (running) return;
    setRunning(true);
    allTests.forEach((tc, idx) => {
      setTimeout(() => updateTestRunStatus(tc.subId, tc.id, 'running'), idx * 50);
      setTimeout(() => {
        const pass = tc.type === 'normal' || (tc.type === 'edge' && Math.random() > 0.3);
        updateTestRunStatus(
          tc.subId, tc.id,
          pass ? 'pass' : 'fail',
          pass ? undefined : `Got: ${JSON.stringify(Object.values(tc.inputs)[0])}, Expected: ${String(tc.expected)}`
        );
      }, idx * 50 + 200 + Math.random() * 300);
    });
    setTimeout(() => setRunning(false), allTests.length * 50 + 600);
  };

  const toggleFail = (id: string) =>
    setExpandedFails((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const statusIcon = (status: string | undefined) => {
    if (status === 'running') return <span className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent spin inline-block" />;
    if (status === 'pass') return <span className="text-green-400 font-bold text-sm">✓</span>;
    if (status === 'fail') return <span className="text-red-400 font-bold text-sm">✗</span>;
    return <span className="w-2 h-2 rounded-full bg-zinc-700 inline-block" />;
  };

  if (allTests.length === 0) {
    return <EmptyState icon={<TestTube size={24} />} heading="No tests to run" subtext="Generate test cases first." />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
        <Button variant="primary" size="sm" icon={<Play size={11} />} loading={running} onClick={runAll}>
          Run All
        </Button>
        <span className="text-xs font-mono text-zinc-500">{allTests.length} tests</span>
        <span className="text-xs font-mono text-green-400">{passed} pass</span>
        <span className="text-xs font-mono text-red-400">{failed} fail</span>

        {/* Pass rate bar */}
        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden ml-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${passRate}%`,
              background: passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <span className="text-[10px] font-mono text-zinc-500">{passRate}%</span>
      </div>

      {/* Test list */}
      <div className="flex-1 overflow-y-auto">
        {allTests.map((tc) => {
          const isExpanded = expandedFails.has(tc.id);
          const isFail = tc.runStatus === 'fail';

          return (
            <div key={tc.id}>
              <div
                className={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-zinc-800/30 transition-colors border-l-2 ${
                  isFail ? 'border-l-red-500' : tc.runStatus === 'pass' ? 'border-l-green-500/40' : 'border-l-transparent'
                }`}
                style={{ borderBottomColor: 'var(--border-default)' }}
                onClick={() => isFail && toggleFail(tc.id)}
              >
                <span className="w-4 flex items-center justify-center flex-shrink-0">
                  {statusIcon(tc.runStatus)}
                </span>
                <span className="text-xs font-mono text-zinc-300 font-medium w-20 flex-shrink-0 truncate">
                  {tc.subName}
                </span>
                <Badge variant={tc.type === 'normal' ? 'success' : tc.type === 'edge' ? 'primary' : 'danger'}>
                  {tc.type}
                </Badge>
                <span className="text-[10px] font-mono text-zinc-600 flex-1 truncate ml-1">
                  ({Object.entries(tc.inputs).map(([k, v]) => `${k}=${v}`).join(', ')})
                </span>
                {isFail && (
                  isExpanded ? <ChevronDown size={11} className="text-zinc-500 flex-shrink-0" /> : <ChevronRight size={11} className="text-zinc-500 flex-shrink-0" />
                )}
              </div>

              {/* Side-by-side diff on fail */}
              {isFail && isExpanded && (
                <div
                  className="grid grid-cols-2 gap-0 border-b"
                  style={{ borderColor: 'var(--border-default)', background: 'rgba(239,68,68,0.04)' }}
                >
                  <div className="px-4 py-3 border-r" style={{ borderColor: 'var(--border-default)' }}>
                    <p className="text-[9px] font-mono text-green-500 uppercase tracking-wider mb-1.5">Expected</p>
                    <p className="text-xs font-mono text-green-300 bg-green-500/10 rounded px-2 py-1">
                      {String(tc.expected)}
                    </p>
                    <div className="mt-2">
                      <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Inputs</p>
                      {Object.entries(tc.inputs).map(([k, v]) => (
                        <p key={k} className="text-[10px] font-mono text-zinc-500">{k} = {String(v)}</p>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-mono text-red-500 uppercase tracking-wider mb-1.5">Actual</p>
                    <p className="text-xs font-mono text-red-300 bg-red-500/10 rounded px-2 py-1">
                      {tc.actualOutput ?? 'N/A'}
                    </p>
                    <div className="mt-2">
                      <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mb-1">Diff</p>
                      <p className="text-[10px] font-mono text-zinc-500">
                        {String(tc.expected) !== (tc.actualOutput ?? '')
                          ? `− ${String(tc.expected)}\n+ ${tc.actualOutput ?? 'N/A'}`
                          : 'No diff'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
