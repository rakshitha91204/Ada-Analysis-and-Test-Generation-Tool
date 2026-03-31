import React, { useState, useMemo, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { SubprogramSearch } from './SubprogramSearch';
import { SubprogramItem } from './SubprogramItem';
import { ContextMenu } from './ContextMenu';
import { EmptyState } from '../shared/EmptyState';
import { Badge } from '../shared/Badge';
import { useContextMenu } from '../../hooks/useContextMenu';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const SubprogramExplorer: React.FC = () => {
  const { subprograms } = useSubprogramStore();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { menu, open, close } = useContextMenu();

  const filtered = useMemo(() => {
    if (!debouncedSearch) return subprograms;
    const q = debouncedSearch.toLowerCase();
    return subprograms.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.parameters.some((p) => p.name.toLowerCase().includes(q))
    );
  }, [subprograms, debouncedSearch]);

  const procedures = useMemo(() => filtered.filter((s) => s.kind === 'procedure'), [filtered]);
  const functions = useMemo(() => filtered.filter((s) => s.kind === 'function'), [filtered]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => open(e, id),
    [open]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={12} className="text-zinc-500" />
          <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
            Subprograms
          </span>
        </div>
        <Badge variant="muted">{subprograms.length}</Badge>
      </div>

      <SubprogramSearch value={search} onChange={setSearch} />

      {subprograms.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} />}
          heading="No subprograms detected"
          subtext="Check diagnostics for parsing errors."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} />}
          heading="No matches"
          subtext={`No subprograms match "${debouncedSearch}"`}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {procedures.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                ⚡ Procedures ({procedures.length})
              </p>
              {procedures.map((s) => (
                <SubprogramItem key={s.id} subprogram={s} onContextMenu={handleContextMenu} />
              ))}
            </div>
          )}
          {functions.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                ƒ Functions ({functions.length})
              </p>
              {functions.map((s) => (
                <SubprogramItem key={s.id} subprogram={s} onContextMenu={handleContextMenu} />
              ))}
            </div>
          )}
        </div>
      )}

      {menu.visible && menu.targetId && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          subprogramId={menu.targetId}
          onClose={close}
        />
      )}
    </div>
  );
};
