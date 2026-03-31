import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download, Play, ChevronDown, BarChart2 } from 'lucide-react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { TestCaseCard } from './TestCaseCard';
import { TestCaseHistory } from './TestCaseHistory';
import { CoverageHeatmap } from './CoverageHeatmap';
import { TestStatsPanel } from '../shared/TestStatsPanel';
import { EmptyState } from '../shared/EmptyState';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { useTestGenerator } from '../../hooks/useTestGenerator';
import { TestTube } from 'lucide-react';

const SkeletonCard: React.FC = () => (
  <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
    <div className="skeleton h-3 w-24 rounded" />
    <div className="skeleton h-3 w-48 rounded" />
    <div className="skeleton h-3 w-36 rounded" />
  </div>
);

export const TestCasePanel: React.FC = () => {
  const { subprograms, selectedSubprogramId, selectSubprogram } = useSubprogramStore();
  const { currentTestSets, exportCurrent, exportAllHistory, exportCurrentAsADB, saveToHistory, setCurrentTests } = useTestCaseStore();
  const { generating, generateForSelected, generateForAll } = useTestGenerator();
  const [exportOpen, setExportOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const dragTo = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const selectedSub = subprograms.find((s) => s.id === selectedSubprogramId);
  const tests = selectedSubprogramId ? (currentTestSets[selectedSubprogramId] || []) : [];

  useEffect(() => {
    if (selectedSubprogramId && !currentTestSets[selectedSubprogramId]?.length) {
      generateForSelected();
    }
  }, [selectedSubprogramId]); // eslint-disable-line

  const handleSaveToHistory = () => {
    if (!selectedSub) return;
    saveToHistory({
      id: crypto.randomUUID(),
      subprogramId: selectedSub.id,
      subprogramName: selectedSub.name,
      timestamp: new Date().toISOString(),
      testCases: tests,
    });
  };

  const handleDragStart = (idx: number) => {
    dragFrom.current = idx;
    setDraggingIdx(idx);
  };
  const handleDragOver = (idx: number) => { dragTo.current = idx; };
  const handleDrop = () => {
    if (dragFrom.current === null || dragTo.current === null || !selectedSubprogramId) return;
    const reordered = [...tests];
    const [moved] = reordered.splice(dragFrom.current, 1);
    reordered.splice(dragTo.current, 0, moved);
    setCurrentTests(selectedSubprogramId, reordered);
    dragFrom.current = null;
    dragTo.current = null;
    setDraggingIdx(null);
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Left column */}
      <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: 'var(--border-default)' }}>
        {/* Subprogram selector */}
        <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
          <select
            value={selectedSubprogramId ?? ''}
            onChange={(e) => selectSubprogram(e.target.value || null)}
            className="flex-1 px-2 py-1 text-xs font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-amber-500/50"
          >
            <option value="">— Select subprogram —</option>
            {subprograms.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kind === 'function' ? 'ƒ' : '⚡'} {s.name}
              </option>
            ))}
          </select>

          {/* Stats toggle */}
          <Button
            variant={showStats ? 'primary' : 'ghost'}
            size="sm"
            icon={<BarChart2 size={11} />}
            onClick={() => setShowStats((v) => !v)}
          >
            Stats
          </Button>
        </div>

        {/* Stats + coverage (collapsible) */}
        {showStats && (
          <div className="p-3 border-b flex flex-col gap-3 flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
            <TestStatsPanel />
            <CoverageHeatmap />
          </div>
        )}

        {/* Action bar */}
        {selectedSubprogramId && (
          <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
            <Button variant="ghost" size="sm" icon={<RefreshCw size={11} />} loading={generating} onClick={generateForSelected}>
              Regenerate
            </Button>
            <Button variant="ghost" size="sm" icon={<Play size={11} />} onClick={generateForAll}>
              All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSaveToHistory}>
              Save
            </Button>

            <div className="relative ml-auto">
              <Button variant="secondary" size="sm" icon={<Download size={11} />} onClick={() => setExportOpen((v) => !v)}>
                Export <ChevronDown size={10} />
              </Button>
              {exportOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-xl overflow-hidden"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', minWidth: 210 }}
                >
                  {[
                    { label: 'Download current as JSON', action: () => exportCurrent(selectedSubprogramId!, selectedSub?.name ?? '') },
                    { label: 'Download all history as JSON', action: exportAllHistory },
                    { label: 'Download as .adb stub', action: () => exportCurrentAsADB(selectedSubprogramId!, selectedSub?.name ?? '') },
                    { label: 'Export as CSV', action: () => exportAsCSV(tests, selectedSub?.name ?? 'tests') },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { item.action(); setExportOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Count badge */}
        {selectedSubprogramId && (
          <div className="px-3 py-1.5 flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Test Cases</span>
            <Badge variant="primary" animate={tests.length > 0}>{tests.length} 🧪</Badge>
            {tests.some((t) => t.runStatus === 'pass') && (
              <span className="text-[10px] font-mono text-green-400 ml-auto">
                {tests.filter((t) => t.runStatus === 'pass').length}/{tests.length} pass
              </span>
            )}
          </div>
        )}

        {/* Test cards */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {!selectedSubprogramId ? (
            <EmptyState
              icon={<TestTube size={28} />}
              heading="Select a subprogram"
              subtext="Test cases will be auto-generated on selection."
            />
          ) : generating ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : tests.length === 0 ? (
            <EmptyState
              icon={<TestTube size={28} />}
              heading="No test cases"
              action={{ label: 'Generate Now', onClick: generateForSelected }}
            />
          ) : (
            tests.map((tc, i) => (
              <TestCaseCard
                key={tc.id}
                testCase={tc}
                index={i}
                subprogramId={selectedSubprogramId}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDragging={draggingIdx === i}
              />
            ))
          )}
        </div>
      </div>

      {/* Right column: history */}
      <div className="w-64 flex-shrink-0 overflow-hidden">
        <TestCaseHistory />
      </div>
    </div>
  );
};

// CSV export helper
function exportAsCSV(tests: import('../../types/testcase.types').TestCase[], name: string) {
  if (tests.length === 0) return;
  const inputKeys = Object.keys(tests[0].inputs);
  const header = [...inputKeys, 'expected', 'type', 'coverageHint', 'runStatus'].join(',');
  const rows = tests.map((t) => [
    ...inputKeys.map((k) => JSON.stringify(t.inputs[k] ?? '')),
    JSON.stringify(t.expected),
    t.type,
    JSON.stringify(t.coverageHint ?? ''),
    t.runStatus ?? 'pending',
  ].join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}_tests.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
