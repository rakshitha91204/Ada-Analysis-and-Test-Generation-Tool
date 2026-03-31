import React, { useState, useMemo, useCallback } from 'react';
import { Layers, FileCode, ChevronDown, ChevronRight, SortAsc, List } from 'lucide-react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { SubprogramSearch } from './SubprogramSearch';
import { SubprogramItem } from './SubprogramItem';
import { ContextMenu } from './ContextMenu';
import { EmptyState } from '../shared/EmptyState';
import { Badge } from '../shared/Badge';
import { Tooltip } from '../shared/Tooltip';
import { useContextMenu } from '../../hooks/useContextMenu';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type GroupMode = 'kind' | 'file' | 'flat';
type SortMode = 'name' | 'line' | 'tests';

export const SubprogramExplorer: React.FC = () => {
  const { subprograms } = useSubprogramStore();
  const { files } = useFileStore();
  const { cursorPosition, activeTab } = useEditorStore();
  const [search, setSearch] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('kind');
  const [sortMode, setSortMode] = useState<SortMode>('line');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(search, 300);
  const { menu, open, close } = useContextMenu();

  const currentLine = cursorPosition.line;

  const filtered = useMemo(() => {
    let list = [...subprograms];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.parameters.some((p) => p.name.toLowerCase().includes(q)) ||
          s.returnType?.toLowerCase().includes(q)
      );
    }
    // Sort
    list.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'line') return a.startLine - b.startLine;
      if (sortMode === 'tests') return (b.testCount || 0) - (a.testCount || 0);
      return 0;
    });
    return list;
  }, [subprograms, debouncedSearch, sortMode]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => open(e, id),
    [open]
  );

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Build grouped structure
  const groups = useMemo(() => {
    if (groupMode === 'flat') {
      return [{ key: 'all', label: `All (${filtered.length})`, items: filtered }];
    }
    if (groupMode === 'kind') {
      const procs = filtered.filter((s) => s.kind === 'procedure');
      const funcs = filtered.filter((s) => s.kind === 'function');
      return [
        { key: 'procedure', label: `⚡ Procedures (${procs.length})`, items: procs },
        { key: 'function', label: `ƒ Functions (${funcs.length})`, items: funcs },
      ].filter((g) => g.items.length > 0);
    }
    if (groupMode === 'file') {
      const byFile = new Map<string, typeof filtered>();
      filtered.forEach((s) => {
        const arr = byFile.get(s.fileId) ?? [];
        arr.push(s);
        byFile.set(s.fileId, arr);
      });
      return Array.from(byFile.entries()).map(([fileId, items]) => {
        const file = files.find((f) => f.id === fileId);
        return { key: fileId, label: file?.name ?? fileId, items };
      });
    }
    return [];
  }, [filtered, groupMode, files]);

  // Which subprogram is the cursor currently inside?
  const { activeFileId } = useFileStore.getState();
  const cursorSubId = useMemo(() => {
    if (activeTab !== 'code') return null;
    return subprograms.find(
      (s) => s.fileId === activeFileId && s.startLine <= currentLine && s.endLine >= currentLine
    )?.id ?? null;
  }, [subprograms, currentLine, activeFileId, activeTab]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={12} className="text-zinc-500" />
          <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
            Outline
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="muted">{subprograms.length}</Badge>

          {/* Group mode toggle */}
          <Tooltip content="Group by: kind / file / flat">
            <button
              onClick={() => setGroupMode((m) => m === 'kind' ? 'file' : m === 'file' ? 'flat' : 'kind')}
              className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title={`Group: ${groupMode}`}
            >
              <List size={11} />
            </button>
          </Tooltip>

          {/* Sort toggle */}
          <Tooltip content={`Sort: ${sortMode} → click to cycle`}>
            <button
              onClick={() => setSortMode((s) => s === 'line' ? 'name' : s === 'name' ? 'tests' : 'line')}
              className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <SortAsc size={11} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Sort indicator */}
      <div className="px-3 pb-1 flex items-center gap-2">
        <span className="text-[9px] font-mono text-zinc-700">
          grouped by <span className="text-zinc-500">{groupMode}</span>
          {' · '}sorted by <span className="text-zinc-500">{sortMode}
          </span>
        </span>
      </div>

      <SubprogramSearch value={search} onChange={setSearch} />

      {subprograms.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} />}
          heading="No subprograms detected"
          subtext="Upload an Ada file or check diagnostics for parse errors."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} />}
          heading="No matches"
          subtext={`Nothing matches "${debouncedSearch}"`}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/30 transition-colors"
                >
                  {isCollapsed
                    ? <ChevronRight size={10} className="text-zinc-600" />
                    : <ChevronDown size={10} className="text-zinc-600" />
                  }
                  {groupMode === 'file' && <FileCode size={10} className="text-amber-500/60" />}
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex-1 text-left">
                    {group.label}
                  </span>
                </button>

                {/* Items */}
                {!isCollapsed && group.items.map((s) => (
                  <SubprogramItem
                    key={s.id}
                    subprogram={s}
                    onContextMenu={handleContextMenu}
                    currentLine={currentLine}
                  />
                ))}
              </div>
            );
          })}

          {/* Cursor location hint */}
          {cursorSubId && (
            <div
              className="mx-3 mt-2 mb-1 px-2 py-1.5 rounded border text-[10px] font-mono"
              style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.2)' }}
            >
              <span className="text-zinc-600">Cursor in: </span>
              <span className="text-blue-400">
                {subprograms.find((s) => s.id === cursorSubId)?.name}
              </span>
              <span className="text-zinc-700"> · L{currentLine}</span>
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
