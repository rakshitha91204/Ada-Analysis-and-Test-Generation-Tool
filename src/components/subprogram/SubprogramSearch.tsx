import React from 'react';
import { Search, X } from 'lucide-react';

interface SubprogramSearchProps {
  value: string;
  onChange: (v: string) => void;
}

export const SubprogramSearch: React.FC<SubprogramSearchProps> = ({ value, onChange }) => {
  return (
    <div className="relative px-3 py-2">
      <Search
        size={12}
        className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
      />
      <input
        id="subprogram-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search subprograms..."
        className="w-full pl-7 pr-7 py-1.5 text-xs font-mono rounded bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
};
