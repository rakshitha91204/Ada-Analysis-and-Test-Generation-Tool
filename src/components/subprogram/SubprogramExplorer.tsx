import React, { useState, useMemo, useCallback, useEffect } from 'react';
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

type GroupMode = 'kind' | 'file' | 'flat';
type SortMode = 'name' | 'line' | 'tests';

export const SubprogramExplorer: React.FC = () => {
  const { subprograms } = useSubprogramStore();
  const { files, activeFileId } = useFileStore();
  const { cursorPosition, activeTab } = useEditorStore();
  const [search, setSearch] = useState('');
  const [groupMode, setGroupMode] = useState<GroupMode>('kind');
  const [sortMode, setSortMode] = useState<SortMode>('line');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { menu, open, close } = useContextMenu();

  const currentLine = cursorPosition.line;

  // Instant filter — no debounce so results appear immediately
  const filtered = useMemo(() => {
    let list = [...subprograms];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.parameters.some((p) => p.name.toLowerCase().includes(q)) ||
          s.returnType?.toLowerCase().includes(q) ||
          s.kind.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'line') return a.startLine - b.startLine;
      if (sortMode === 'tests') return (b.testCount || 0) - (a.testCount || 0);
      return 0;
    });
    return list;
  }, [subprograms, search, sortMode]);

  // Auto-expand all groups when searching
  useEffect(() => {
    if (search.trim()) setCollapsedGroups(new Set());
  }, [search]);

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

  const groups = useMemo(() => {
    if (groupMode === 'flat') {
      return [{ key: 'all', label: `All (${filtered.length})`, items: filtered }];
    }
    if (groupMode === 'kind') {
      const procs = filtered.filter((s) => s.kind === 'procedure');
      const funcs = filtered.filter((s) => s.kind === 'function');
      return [
        { key: 'procedure', label: `⚡ Procedures`, count: procs.length, items: procs },
        { key: 'function', label: `ƒ Functions`, count: funcs.length, items: funcs },
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
        return { key: fileId, label: file?.name ?? fileId, count: items.length, items };
      });
    }
    return [];
  }, [filtered, groupMode, files]);

  // Which subprogram contains the cursor right now
  const cursorSubId = useMemo(() => {
    if (activeTab !== 'code') return null;
    return (
      subprograms.find(
        (s) => s.fileId === activeFileId && s.startLine <= currentLine && s.endLine >= currentLine
      )?.id ?? null
    );
  }, [subprograms, currentLine, activeFileId, activeTab]);

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
        <div className="flex items-center gap-1">
          <Badge variant="muted">{subprograms.length}</Badge>
          <Tooltip content={`Group: ${groupMode} — click to cycle`}>
            <button
              onClick={() => setGroupMode((m) => m === 'kind' ? 'file' : m === 'file' ? 'flat' : 'kind')}
              className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <List size={11} />
            </button>
          </Tooltip>
          <Tooltip content={`Sort: ${sortMode} — click to cycle`}>
            <button
              onClick={() => setSortMode((s) => s === 'line' ? 'name' : s === 'name' ? 'tests' : 'line')}
              className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <SortAsc size={11} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Search */}
      <SubprogramSearch
        value={search}
        onChange={setSearch}
        resultCount={search.trim() ? filtered.length : undefined}
      />

      {subprograms.length === 0 ? (
        <EmptyState
          icon={<Layers size={24} />}
          heading="No subprograms detected"
          subtext="Upload an Ada file — subprograms will appear here."
        />
      ) : filtered.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-xs font-mono text-zinc-500">No match for</p>
          <p className="text-xs font-mono text-amber-400 mt-0.5">"{search}"</p>
          <button
            onClick={() => setSearch('')}
            className="mt-2 text-[10px] font-mono text-zinc-600 hover:text-zinc-400 underline transition-colors"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800/30 transition-colors group"
                >
                  {isCollapsed
                    ? <ChevronRight size={10} className="text-zinc-600" />
                    : <ChevronDown size={10} className="text-zinc-600" />
                  }
                  {groupMode === 'file' && <FileCode size={10} className="text-amber-500/60" />}
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest flex-1 text-left">
                    {group.label}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-700">{'count' in group ? group.count : ''}</span>
                </button>

                {/* Subprogram rows */}
                {!isCollapsed && group.items.map((s) => (
                  <SubprogramItem
                    key={s.id}
                    subprogram={s}
                    onContextMenu={handleContextMenu}
                    currentLine={currentLine}
                    searchQuery={search}
                  />
                ))}
              </div>
            );
          })}

          {/* Cursor location hint */}
          {cursorSubId && (
            <div
              className="mx-3 mt-2 mb-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono flex items-center gap-2"
              style={{ background: 'rgba(59,130,246,0.07)', borderColor: 'rgba(59,130,246,0.2)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="text-zinc-600">Inside:</span>
              <span className="text-blue-300 font-semibold">
                {subprograms.find((s) => s.id === cursorSubId)?.name}
              </span>
              <span className="text-zinc-700 ml-auto">L{currentLine}</span>
            </div>
          )}
        </div>
      )}

      {menu.visible && menu.targetId && (
        <ContextMenu x={menu.x} y={menu.y} subprogramId={menu.targetId} onClose={close} />
      )}
    </div>
  );
};
