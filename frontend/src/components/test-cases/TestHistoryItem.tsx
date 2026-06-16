import React, { useState } from 'react';
import { RotateCcw, Trash2, Tag, Check, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { TestCaseSet } from '../../types/testcase.types';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { format } from 'date-fns';

interface TestHistoryItemProps {
  set: TestCaseSet;
}

function StatusPill({ status }: { status?: string }) {
  if (!status || status === 'pending')
    return <span style={{ color: '#71717a', fontSize: 9, fontFamily: 'monospace' }}>pending</span>;
  const colors: Record<string, string> = { pass: '#4ade80', fail: '#f87171', error: '#fbbf24', running: '#60a5fa' };
  return (
    <span style={{ color: colors[status] ?? '#71717a', fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>
      {status.toUpperCase()}
    </span>
  );
}

export const TestHistoryItem: React.FC<TestHistoryItemProps> = ({ set }) => {
  const { loadFromHistory, deleteHistory, updateTag, exportCurrent } = useTestCaseStore();
  const [editingTag, setEditingTag]   = useState(false);
  const [tagValue, setTagValue]       = useState(set.tag ?? '');
  const [expanded, setExpanded]       = useState(false);

  const handleSaveTag = () => {
    updateTag(set.id, tagValue);
    setEditingTag(false);
  };

  const timeStr = (() => {
    try { return format(new Date(set.timestamp), 'MMM d, HH:mm'); }
    catch { return set.timestamp; }
  })();

  const passCount  = set.testCases.filter(tc => tc.runStatus === 'pass').length;
  const failCount  = set.testCases.filter(tc => tc.runStatus === 'fail').length;
  const totalRan   = set.testCases.filter(tc => tc.runStatus && tc.runStatus !== 'pending' && tc.runStatus !== 'running').length;

  return (
    <div
      className="flex flex-col rounded-lg border transition-all"
      style={{ background: 'var(--bg-elevated)', borderColor: expanded ? 'rgba(245,158,11,0.3)' : 'var(--border-default)' }}
    >
      {/* ── Header row ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-0.5 px-3 pt-2 pb-1">
        <div className="flex items-center gap-2">
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
            title={expanded ? 'Collapse' : 'Show test details'}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>

          <span className="text-xs font-mono text-zinc-200 flex-1 truncate">{set.subprogramName}</span>

          {/* Pass/fail badge */}
          {totalRan > 0 && (
            <span className="text-[9px] font-mono flex-shrink-0"
              style={{ color: failCount > 0 ? '#f87171' : '#4ade80' }}>
              {passCount}/{totalRan}
            </span>
          )}
          <span className="text-[9px] font-mono text-amber-500 flex-shrink-0">{set.testCases.length} tests</span>
        </div>

        <div className="flex items-center gap-1 pl-4">
          <span className="text-[10px] font-mono text-zinc-600 flex-1">{timeStr}</span>
          {set.tag && !editingTag && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
              {set.tag}
            </span>
          )}
        </div>
      </div>

      {/* ── Tag edit row ──────────────────────────────────────────── */}
      {editingTag && (
        <div className="flex items-center gap-1 mx-3 mb-1">
          <input
            autoFocus
            type="text"
            value={tagValue}
            onChange={e => setTagValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveTag(); if (e.key === 'Escape') setEditingTag(false); }}
            className="flex-1 px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 border border-amber-500/40 text-zinc-200 focus:outline-none"
            placeholder="Tag name..."
          />
          <button onClick={handleSaveTag} className="text-green-400 hover:text-green-300">
            <Check size={11} />
          </button>
        </div>
      )}

      {/* ── Expanded: test case detail ────────────────────────────── */}
      {expanded && (
        <div className="mx-3 mb-2 flex flex-col gap-1.5">
          <div className="border-t pt-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: '#71717a' }}>
              Test Cases
            </p>
            {set.testCases.map((tc, idx) => (
              <div key={tc.id} className="mb-1.5 rounded p-1.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Row: type badge + status */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono px-1 rounded flex-shrink-0"
                    style={{
                      background: tc.type === 'normal' ? 'rgba(34,197,94,0.15)' : tc.type === 'edge' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                      color: tc.type === 'normal' ? '#4ade80' : tc.type === 'edge' ? '#f59e0b' : '#f87171',
                    }}>
                    {tc.type}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 flex-1">Test {idx + 1}</span>
                  <StatusPill status={tc.runStatus} />
                </div>
                {/* Inputs */}
                {Object.keys(tc.inputs).length > 0 && (
                  <div className="mb-0.5">
                    <span className="text-[8px] font-mono text-zinc-600">inputs: </span>
                    <span className="text-[8px] font-mono text-zinc-300">
                      {Object.entries(tc.inputs).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}
                    </span>
                  </div>
                )}
                {/* Expected */}
                <div className="mb-0.5">
                  <span className="text-[8px] font-mono text-zinc-600">expected: </span>
                  <span className="text-[8px] font-mono" style={{ color: '#a5b4fc' }}>
                    {String(tc.expected)}
                  </span>
                </div>
                {/* Actual output */}
                {tc.actualOutput && (
                  <div>
                    <span className="text-[8px] font-mono text-zinc-600">actual: </span>
                    <span className="text-[8px] font-mono" style={{ color: tc.runStatus === 'pass' ? '#4ade80' : '#f87171' }}>
                      {tc.actualOutput}
                    </span>
                  </div>
                )}
                {/* Coverage hint */}
                {tc.coverageHint && (
                  <div className="mt-0.5">
                    <span className="text-[8px] font-mono text-zinc-700 italic">{tc.coverageHint}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          onClick={() => loadFromHistory(set.id)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          title="Load test set into Test Studio"
        >
          <RotateCcw size={9} /> Load
        </button>
        <button
          onClick={() => setEditingTag(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          title="Tag this entry"
        >
          <Tag size={9} /> Tag
        </button>
        <button
          onClick={() => exportCurrent(set.subprogramId, set.subprogramName)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
          title="Download this test set as JSON"
        >
          <Download size={9} /> JSON
        </button>
        <button
          onClick={() => deleteHistory(set.id)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
          title="Delete"
        >
          <Trash2 size={9} />
        </button>
      </div>
    </div>
  );
};
