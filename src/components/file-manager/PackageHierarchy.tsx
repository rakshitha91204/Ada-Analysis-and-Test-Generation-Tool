import React, { useMemo, useState, useCallback } from 'react';
import { Package, ChevronDown, ChevronRight, Link, Zap, FunctionSquare } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { analyzeAdaFile, findLinkedFile } from '../../utils/adaParser';
import { showToast } from '../shared/Toast';
import { ContextMenu } from '../subprogram/ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';

export const PackageHierarchy: React.FC = () => {
  const { files, setActiveFile } = useFileStore();
  const { subprograms, selectSubprogram } = useSubprogramStore();
  const { openTab, setActiveTab, navigateTo } = useEditorStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { menu, open, close } = useContextMenu();

  const hierarchy = useMemo(() => {
    return files.map((file) => {
      const analysis = analyzeAdaFile(file.content, file.id);
      const fileSubs = subprograms.filter((s) => s.fileId === file.id);
      const linkedId = findLinkedFile(file.name, files);
      return { file, analysis, subprograms: fileSubs, linkedId };
    });
  }, [files, subprograms]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const openFile = (fileId: string, line?: number) => {
    setActiveFile(fileId);
    openTab(fileId);
    setActiveTab('code');
    if (line) setTimeout(() => navigateTo(line, fileId), 80);
  };

  const jumpToLinked = (linkedId: string) => {
    openFile(linkedId);
    showToast('Jumped to linked file', 'info');
  };

  const handleSubRightClick = useCallback(
    (e: React.MouseEvent, subId: string) => {
      e.preventDefault();
      e.stopPropagation();
      open(e, subId);
    },
    [open]
  );

  if (files.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <Package size={12} className="text-zinc-500" />
        <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
          Package Hierarchy
        </span>
      </div>

      {hierarchy.map(({ file, analysis, subprograms: fileSubs, linkedId }) => {
        const isCollapsed = collapsed.has(file.id);
        const pkgName = analysis.packages[0]?.name ?? file.name.replace(/\.(ads|adb)$/, '');

        return (
          <div key={file.id} className="border-b" style={{ borderColor: 'var(--border-default)' }}>
            {/* Package header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/30 transition-colors"
              onClick={() => toggle(file.id)}
            >
              {isCollapsed
                ? <ChevronRight size={10} className="text-zinc-600" />
                : <ChevronDown size={10} className="text-zinc-600" />
              }
              <Package size={11} className="text-amber-500/70 flex-shrink-0" />
              <span className="text-xs font-mono text-zinc-300 flex-1 truncate">{pkgName}</span>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                file.type === 'spec'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-orange-500/15 text-orange-400'
              }`}>
                {file.type === 'spec' ? 'spec' : 'body'}
              </span>
              {linkedId && (
                <button
                  onClick={(e) => { e.stopPropagation(); jumpToLinked(linkedId); }}
                  title={`Jump to ${file.type === 'spec' ? 'body' : 'spec'}`}
                  className="p-0.5 rounded text-zinc-600 hover:text-amber-400 transition-colors"
                >
                  <Link size={10} />
                </button>
              )}
            </div>

            {/* Package contents */}
            {!isCollapsed && (
              <div className="pl-4">
                {/* With clauses */}
                {analysis.withClauses.length > 0 && (
                  <div className="px-3 py-1">
                    <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest mb-1">
                      Dependencies
                    </p>
                    {analysis.withClauses.map((w) => (
                      <p key={`${w.packageName}_${w.line}`} className="text-[10px] font-mono text-zinc-600 pl-2">
                        with <span className="text-blue-400/70">{w.packageName}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* Tasks */}
                {analysis.tasks.length > 0 && (
                  <div className="px-3 py-1">
                    <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest mb-1">
                      Tasks ({analysis.tasks.length})
                    </p>
                    {analysis.tasks.map((t) => (
                      <div
                        key={t.name}
                        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-zinc-800/30 rounded px-1 transition-colors"
                        onClick={() => openFile(file.id, t.startLine)}
                      >
                        <span className="text-[9px] font-mono px-1 rounded bg-purple-500/15 text-purple-400">task</span>
                        <span className="text-[10px] font-mono text-zinc-300">{t.name}</span>
                        {t.entries.length > 0 && (
                          <span className="text-[9px] font-mono text-zinc-600">{t.entries.length} entries</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Exceptions */}
                {analysis.exceptions.length > 0 && (
                  <div className="px-3 py-1">
                    <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest mb-1">
                      Exceptions
                    </p>
                    {analysis.exceptions.slice(0, 5).map((ex, i) => (
                      <div
                        key={`${ex.name}_${i}`}
                        className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-zinc-800/30 rounded px-1 transition-colors"
                        onClick={() => openFile(file.id, ex.line)}
                      >
                        <span className="text-[9px] font-mono px-1 rounded bg-red-500/15 text-red-400">exc</span>
                        <span className="text-[10px] font-mono text-zinc-400">{ex.name}</span>
                        <span className="text-[9px] font-mono text-zinc-700 ml-auto">L{ex.line}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subprograms — right-click for context menu */}
                {fileSubs.length > 0 && (
                  <div className="px-3 py-1">
                    <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest mb-1">
                      Subprograms ({fileSubs.length})
                    </p>
                    {fileSubs.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-zinc-800/40 rounded px-1.5 transition-colors group select-none"
                        onClick={() => {
                          selectSubprogram(sub.id);
                          openFile(file.id, sub.startLine);
                        }}
                        onContextMenu={(e) => {
                          selectSubprogram(sub.id);
                          handleSubRightClick(e, sub.id);
                        }}
                        title="Right-click for actions"
                      >
                        {sub.kind === 'procedure'
                          ? <Zap size={11} className="text-amber-500/70 flex-shrink-0" />
                          : <FunctionSquare size={11} className="text-orange-500/70 flex-shrink-0" />
                        }
                        <span className="text-[10px] font-mono text-zinc-300 flex-1 truncate">{sub.name}</span>
                        {/* Right-click hint — visible on hover */}
                        <span className="text-[8px] font-mono text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                          right-click
                        </span>
                        <span className="text-[9px] font-mono text-zinc-700 group-hover:text-zinc-500 flex-shrink-0">
                          L{sub.startLine}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Context menu portal */}
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
