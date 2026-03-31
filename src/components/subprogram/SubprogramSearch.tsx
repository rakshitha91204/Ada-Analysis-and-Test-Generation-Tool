import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SubprogramSearchProps {
  value: string;
  onChange: (v: string) => void;
  resultCount?: number;
}

export const SubprogramSearch: React.FC<SubprogramSearchProps> = ({
  value,
  onChange,
  resultCount,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative px-3 py-2">
      <Search
        size={12}
        className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
      />
      <input
        ref={inputRef}
        id="subprogram-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search subprograms..."
        className="w-full pl-7 pr-7 py-1.5 text-xs font-mono rounded-lg border text-zinc-200 placeholder-zinc-600 focus:outline-none transition-colors"
        style={{
          background: 'var(--bg-elevated)',
          borderColor: value ? 'var(--accent-primary)' : 'var(--border-default)',
        }}
      />
      {value ? (
        <button
          onClick={() => { onChange(''); inputRef.current?.focus(); }}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={11} />
        </button>
      ) : null}

      {/* Result count badge */}
      {value && resultCount !== undefined && (
        <div className="mt-1 px-1">
          <span className="text-[9px] font-mono text-zinc-600">
            {resultCount === 0 ? 'No matches' : `${resultCount} match${resultCount !== 1 ? 'es' : ''}`}
          </span>
        </div>
      )}
    </div>
  );
};
