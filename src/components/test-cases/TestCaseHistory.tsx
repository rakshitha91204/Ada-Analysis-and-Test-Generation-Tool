import React from 'react';
import { History } from 'lucide-react';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { TestHistoryItem } from './TestHistoryItem';
import { EmptyState } from '../shared/EmptyState';

export const TestCaseHistory: React.FC = () => {
  const { history } = useTestCaseStore();
  const displayed = history.slice(0, 50);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0 border-b" style={{ borderColor: 'var(--border-default)' }}>
        <History size={12} className="text-zinc-500" />
        <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
          Test History
        </span>
        <span className="ml-auto text-[10px] font-mono text-zinc-600">{history.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {displayed.length === 0 ? (
          <EmptyState
            icon={<History size={20} />}
            heading="No history yet"
            subtext="Generated test sets will appear here"
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
