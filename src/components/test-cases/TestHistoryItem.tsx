import React, { useState } from 'react';
import { RotateCcw, Trash2, Tag, Check } from 'lucide-react';
import { TestCaseSet } from '../../types/testcase.types';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { format } from 'date-fns';

interface TestHistoryItemProps {
  set: TestCaseSet;
}

export const TestHistoryItem: React.FC<TestHistoryItemProps> = ({ set }) => {
  const { loadFromHistory, deleteHistory, updateTag } = useTestCaseStore();
  const [editingTag, setEditingTag] = useState(false);
  const [tagValue, setTagValue] = useState(set.tag ?? '');

  const handleSaveTag = () => {
    updateTag(set.id, tagValue);
    setEditingTag(false);
  };

  const timeStr = (() => {
    try {
      return format(new Date(set.timestamp), 'MMM d, HH:mm');
    } catch {
      return set.timestamp;
    }
  })();

  return (
    <div
      className="flex flex-col gap-1 px-3 py-2 rounded-lg border transition-all hover:border-zinc-600"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-zinc-200 flex-1 truncate">{set.subprogramName}</span>
        <span className="text-[10px] font-mono text-amber-500">{set.testCases.length} tests</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono text-zinc-600 flex-1">{timeStr}</span>
        {set.tag && !editingTag && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
            {set.tag}
          </span>
        )}
      </div>

      {editingTag && (
        <div className="flex items-center gap-1 mt-1">
          <input
            autoFocus
            type="text"
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTag(); if (e.key === 'Escape') setEditingTag(false); }}
            className="flex-1 px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 border border-amber-500/40 text-zinc-200 focus:outline-none"
            placeholder="Tag name..."
          />
          <button onClick={handleSaveTag} className="text-green-400 hover:text-green-300">
            <Check size={11} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 mt-0.5">
        <button
          onClick={() => loadFromHistory(set.id)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
          title="Load this test set"
        >
          <RotateCcw size={9} /> Load
        </button>
        <button
          onClick={() => setEditingTag(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          title="Rename/tag"
        >
          <Tag size={9} /> Tag
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
