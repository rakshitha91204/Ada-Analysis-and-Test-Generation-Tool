import React from 'react';
import { History, Download } from 'lucide-react';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { TestHistoryItem } from './TestHistoryItem';
import { EmptyState } from '../shared/EmptyState';

export const TestCaseHistory: React.FC = () => {
  const { history, exportAllHistory } = useTestCaseStore();
  const displayed = history.slice(0, 50);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--border-default)' }}>
        <History size={12} className="text-zinc-500" />
        <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
          Test History
        </span>
        <span className="ml-auto text-[10px] font-mono text-zinc-600">{history.length}</span>
        {history.length > 0 && (
          <button
            onClick={exportAllHistory}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ml-1"
            style={{ color: '#71717a', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4ade80'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74,222,128,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#71717a'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
            title="Download all test history as JSON"
          >
            <Download size={9} /> All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {displayed.length === 0 ? (
          <EmptyState
            icon={<History size={20} />}
            heading="No history yet"
            subtext="Run tests to record history here. History persists after restart."
          />
        ) : (
          displayed.map((set) => <TestHistoryItem key={set.id} set={set} />)
        )}
        {history.length > 50 && (
          <p className="text-center text-[10px] font-mono text-zinc-600 py-2">
            Showing 50 of {history.length} entries
          </p>
        )}
      </div>
    </div>
  );
};
