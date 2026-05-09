import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, FileCode, Zap, FunctionSquare, TestTube, Settings, GitBranch, BarChart2 } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'file' | 'subprogram' | 'action' | 'view';
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { files, setActiveFile } = useFileStore();
  const { subprograms, selectSubprogram } = useSubprogramStore();
  const { setActiveTab, openTab } = useEditorStore();
  const { generateTests } = useTestCaseStore();

  const commands = useMemo((): Command[] => {
    const cmds: Command[] = [];

    // File commands
    files.forEach((f) => {
      cmds.push({
        id: `file_${f.id}`,
        label: f.name,
        description: f.type === 'spec' ? 'Ada Specification' : 'Ada Body',
        icon: <FileCode size={14} className="text-amber-400" />,
        category: 'file',
        action: () => { setActiveFile(f.id); openTab(f.id); setActiveTab('code'); },
      });
    });

    // Subprogram commands
    subprograms.forEach((s) => {
      cmds.push({
        id: `sub_${s.id}`,
        label: s.name,
        description: `${s.kind} · ${s.parameters.length} params${s.returnType ? ` → ${s.returnType}` : ''}`,
        icon: s.kind === 'procedure'
          ? <Zap size={14} className="text-amber-400" />
          : <FunctionSquare size={14} className="text-orange-400" />,
        category: 'subprogram',
        action: () => { selectSubprogram(s.id); setActiveTab('tests'); },
      });
    });

    // Action commands
    cmds.push(
      {
        id: 'action_tests',
        label: 'Switch to Test Cases',
        icon: <TestTube size={14} className="text-green-400" />,
        shortcut: 'Ctrl+Shift+T',
        category: 'action',
        action: () => setActiveTab('tests'),
      },
      {
        id: 'action_graph',
        label: 'Switch to Call Graph',
        icon: <GitBranch size={14} className="text-blue-400" />,
        shortcut: 'Ctrl+Shift+G',
        category: 'action',
        action: () => setActiveTab('graph'),
      },
      {
        id: 'action_analysis',
        label: 'Switch to Analysis',
        icon: <BarChart2 size={14} className="text-purple-400" />,
        category: 'action',
        action: () => setActiveTab('analysis'),
      },
      {
        id: 'action_code',
        label: 'Switch to Code View',
        icon: <FileCode size={14} className="text-zinc-400" />,
        category: 'action',
        action: () => setActiveTab('code'),
      },
      {
        id: 'action_gen_all',
        label: 'Generate Tests for All Subprograms',
        icon: <TestTube size={14} className="text-amber-400" />,
        category: 'action',
        action: () => subprograms.forEach((s) => generateTests(s)),
      },
      {
        id: 'action_settings',
        label: 'Open Settings',
        icon: <Settings size={14} className="text-zinc-400" />,
        shortcut: 'Ctrl+,',
        category: 'action',
        action: () => {},
      }
    );

    return cmds;
  }, [files, subprograms, setActiveFile, openTab, setActiveTab, selectSubprogram, generateTests]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 12);
    const q = query.toLowerCase();
    return commands
      .filter((c) => c.label.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))
      .slice(0, 12);
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selected]) { filtered[selected].action(); onClose(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const categoryLabel: Record<string, string> = {
    file: 'FILES', subprogram: 'SUBPROGRAMS', action: 'ACTIONS', view: 'VIEWS',
  };

  let lastCategory = '';

  return (
    <div
      className="fixed inset-0 z-[9995] flex items-start justify-center pt-24"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border shadow-2xl overflow-hidden context-menu-enter"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-active)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <Search size={16} className="text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, subprograms, actions..."
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none font-mono"
          />
          <kbd className="text-[10px] font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 360 }}>
          {filtered.length === 0 ? (
            <p className="text-center text-xs font-mono text-zinc-600 py-8">No results for "{query}"</p>
          ) : (
            filtered.map((cmd, i) => {
              const showCategory = cmd.category !== lastCategory;
              lastCategory = cmd.category;
              return (
                <React.Fragment key={cmd.id}>
                  {showCategory && (
                    <p className="px-4 pt-2 pb-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                      {categoryLabel[cmd.category]}
                    </p>
                  )}
                  <div
                    onClick={() => { cmd.action(); onClose(); }}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      i === selected ? 'bg-amber-500/10 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    <span className="flex-shrink-0">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">{cmd.label}</p>
                      {cmd.description && (
                        <p className="text-[10px] text-zinc-600 truncate">{cmd.description}</p>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="text-[9px] font-mono text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 flex-shrink-0">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t flex items-center gap-4" style={{ borderColor: 'var(--border-default)' }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[10px] font-mono text-zinc-600">
              <kbd className="bg-zinc-800 border border-zinc-700 px-1 rounded">{key}</kbd> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
