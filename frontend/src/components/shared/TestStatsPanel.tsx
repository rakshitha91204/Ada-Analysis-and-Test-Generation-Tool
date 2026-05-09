import React from 'react';
import { TestTube, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';

export const TestStatsPanel: React.FC = () => {
  const { currentTestSets } = useTestCaseStore();
  const { subprograms } = useSubprogramStore();

  const allTests = subprograms.flatMap((s) => currentTestSets[s.id] || []);
  const total = allTests.length;
  const passed = allTests.filter((t) => t.runStatus === 'pass').length;
  const failed = allTests.filter((t) => t.runStatus === 'fail').length;
  const pending = allTests.filter((t) => !t.runStatus || t.runStatus === 'pending').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const normalCount = allTests.filter((t) => t.type === 'normal').length;
  const edgeCount = allTests.filter((t) => t.type === 'edge').length;
  const invalidCount = allTests.filter((t) => t.type === 'invalid').length;

  const stats = [
    { label: 'Total', value: total, icon: <TestTube size={13} />, color: 'text-zinc-400' },
    { label: 'Pass', value: passed, icon: <CheckCircle size={13} />, color: 'text-green-400' },
    { label: 'Fail', value: failed, icon: <XCircle size={13} />, color: 'text-red-400' },
    { label: 'Pending', value: pending, icon: <Clock size={13} />, color: 'text-zinc-500' },
  ];

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-center gap-2">
        <TrendingUp size={13} className="text-amber-400" />
        <span className="text-xs font-mono font-semibold text-zinc-300">Test Statistics</span>
        <span className="ml-auto text-xs font-mono font-bold text-amber-400">{passRate}% pass rate</span>
      </div>

      {/* Pass rate bar */}
      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${passRate}%`,
            background: passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-zinc-800/40">
            <span className={s.color}>{s.icon}</span>
            <span className={`text-sm font-mono font-bold ${s.color}`}>{s.value}</span>
            <span className="text-[9px] font-mono text-zinc-600 uppercase">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Type breakdown */}
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-zinc-600">Types:</span>
        <span className="text-green-400">{normalCount} normal</span>
        <span className="text-zinc-700">·</span>
        <span className="text-amber-400">{edgeCount} edge</span>
        <span className="text-zinc-700">·</span>
        <span className="text-red-400">{invalidCount} invalid</span>
      </div>
    </div>
  );
};
