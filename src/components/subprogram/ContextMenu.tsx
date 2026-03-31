import React, { useEffect, useRef } from 'react';
import {
  TestTube2,
  Variable,
  List,
  BarChart2,
  GitBranch,
  AlertTriangle,
  ArrowRight,
  Copy,
  Pin,
  FileCode,
  Zap,
  FunctionSquare,
  ChevronRight,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useFileStore } from '../../store/useFileStore';
import { generateTestCases } from '../../utils/testCaseGenerator';
import { showToast } from '../shared/Toast';

interface ContextMenuProps {
  x: number;
  y: number;
  subprogramId: string;
  onClose: () => void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  description?: string;
  action: () => void;
  variant?: 'default' | 'primary' | 'danger';
  dividerBefore?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, subprogramId, onClose }) => {
  const { setActiveTab, navigateTo, openTab } = useEditorStore();
  const { subprograms, selectSubprogram, togglePin } = useSubprogramStore();
  const { setCurrentTests, currentTestSets } = useTestCaseStore();
  const { setActiveFile } = useFileStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const sub = subprograms.find((s) => s.id === subprogramId);
  const existingTests = sub ? (currentTestSets[sub.id] || []) : [];
  const isPinned = sub?.pinned ?? false;

  // Adjust position so menu stays inside viewport
  const menuWidth = 248;
  const menuHeight = 380;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  // Close on outside click or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const run = (action: () => void) => {
    action();
    onClose();
  };

  const menuItems: MenuItem[] = [
    {
      icon: <TestTube2 size={14} />,
      label: 'Generate Test Cases',
      shortcut: 'Ctrl+Enter',
      description: existingTests.length > 0 ? `Regenerate (${existingTests.length} exist)` : 'Auto-generate normal, edge & invalid',
      variant: 'primary',
      action: () => {
        if (!sub) return;
        const tests = generateTestCases(sub);
        setCurrentTests(subprogramId, tests);
        selectSubprogram(subprogramId);
        setActiveTab('tests');
        showToast(`Generated ${tests.length} test cases for ${sub.name}`, 'success');
      },
    },
    {
      icon: <ArrowRight size={14} />,
      label: 'Go to Definition',
      shortcut: 'F12',
      description: `Jump to line ${sub?.startLine}`,
      action: () => {
        if (!sub) return;
        selectSubprogram(sub.id);
        setActiveFile(sub.fileId);
        openTab(sub.fileId);
        setActiveTab('code');
        setTimeout(() => navigateTo(sub.startLine, sub.fileId, sub.id), 80);
      },
    },
    {
      icon: <Variable size={14} />,
      label: 'View Variables',
      description: 'Show local variable analysis',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      icon: <List size={14} />,
      label: 'Show Parameters',
      description: sub ? `${sub.parameters.length} parameter${sub.parameters.length !== 1 ? 's' : ''}` : '',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('tests');
      },
    },
    {
      icon: <BarChart2 size={14} />,
      label: 'Coverage Report',
      description: existingTests.length > 0
        ? `${existingTests.filter(t => t.runStatus === 'pass').length}/${existingTests.length} passing`
        : 'No tests yet',
      dividerBefore: true,
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      icon: <GitBranch size={14} />,
      label: 'Call Graph',
      shortcut: 'Ctrl+Shift+G',
      description: 'Visualize call relationships',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('graph');
      },
    },
    {
      icon: <AlertTriangle size={14} />,
      label: 'Dead Code Analysis',
      description: 'Find unreachable branches',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      icon: <Copy size={14} />,
      label: 'Copy Signature',
      description: 'Copy to clipboard',
      dividerBefore: true,
      action: () => {
        if (!sub) return;
        const params = sub.parameters.map(p => `${p.name} : ${p.mode} ${p.paramType}`).join('; ');
        const sig = sub.kind === 'function'
          ? `function ${sub.name} (${params}) return ${sub.returnType}`
          : `procedure ${sub.name} (${params})`;
        navigator.clipboard.writeText(sig);
        showToast('Signature copied to clipboard', 'success');
      },
    },
    {
      icon: isPinned ? <Pin size={14} className="text-amber-400" /> : <Pin size={14} />,
      label: isPinned ? 'Unpin Subprogram' : 'Pin to Top',
      description: isPinned ? 'Remove from pinned' : 'Keep at top of outline',
      action: () => {
        togglePin(subprogramId);
        showToast(isPinned ? `Unpinned ${sub?.name}` : `Pinned ${sub?.name} to top`, 'info');
      },
    },
  ];

  if (!sub) return null;

  return (
    <>
      {/* Invisible backdrop to catch outside clicks */}
      <div
        className="fixed inset-0 z-[9997]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      <div
        ref={menuRef}
        className="context-menu-enter fixed z-[9998] rounded-xl overflow-hidden"
        style={{
          left: adjustedX,
          top: adjustedY,
          width: menuWidth,
          background: 'rgba(18,18,22,0.98)',
          border: '1px solid rgba(245,158,11,0.25)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(245,158,11,0.06)',
          backdropFilter: 'blur(12px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — subprogram signature */}
        <div
          className="px-3 py-2.5"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(251,146,60,0.06) 100%)',
            borderBottom: '1px solid rgba(245,158,11,0.15)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            {sub.kind === 'procedure'
              ? <Zap size={12} className="text-amber-400 flex-shrink-0" />
              : <FunctionSquare size={12} className="text-orange-400 flex-shrink-0" />
            }
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              {sub.kind}
            </span>
            <span className="ml-auto text-[9px] font-mono text-zinc-700">
              L{sub.startLine}–{sub.endLine}
            </span>
          </div>
          <p className="text-sm font-mono font-bold text-amber-300 truncate">{sub.name}</p>
          {sub.parameters.length > 0 && (
            <p className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">
              ({sub.parameters.map(p => `${p.name}: ${p.paramType}`).join(', ')})
            </p>
          )}
          {sub.returnType && (
            <p className="text-[10px] font-mono text-orange-400/70 mt-0.5">
              → {sub.returnType}
            </p>
          )}
        </div>

        {/* Menu items */}
        <div className="py-1">
          {menuItems.map((item, i) => (
            <React.Fragment key={item.label}>
              {item.dividerBefore && (
                <div className="my-1 mx-2" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
              )}
              <button
                onClick={() => run(item.action)}
                className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-all group ${
                  item.variant === 'primary'
                    ? 'hover:bg-amber-500/15'
                    : item.variant === 'danger'
                    ? 'hover:bg-red-500/15'
                    : 'hover:bg-white/5'
                }`}
              >
                {/* Icon */}
                <span
                  className={`mt-0.5 flex-shrink-0 transition-colors ${
                    item.variant === 'primary'
                      ? 'text-amber-400'
                      : item.variant === 'danger'
                      ? 'text-red-400'
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                >
                  {item.icon}
                </span>

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium leading-tight ${
                      item.variant === 'primary'
                        ? 'text-amber-300 group-hover:text-amber-200'
                        : item.variant === 'danger'
                        ? 'text-red-300'
                        : 'text-zinc-200 group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </p>
                  {item.description && (
                    <p className="text-[10px] text-zinc-600 group-hover:text-zinc-500 mt-0.5 truncate">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Shortcut or arrow */}
                {item.shortcut ? (
                  <kbd className="flex-shrink-0 text-[9px] font-mono text-zinc-700 bg-zinc-800/80 border border-zinc-700/50 px-1.5 py-0.5 rounded mt-0.5">
                    {item.shortcut}
                  </kbd>
                ) : (
                  <ChevronRight size={11} className="flex-shrink-0 text-zinc-700 group-hover:text-zinc-500 mt-0.5 opacity-0 group-hover:opacity-100 transition-all" />
                )}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-3 py-1.5 flex items-center gap-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <FileCode size={9} className="text-zinc-700" />
          <span className="text-[9px] font-mono text-zinc-700 truncate">
            {sub.fileId.includes('ads') || sub.fileId.includes('spec') ? 'spec' : 'body'} · {sub.endLine - sub.startLine + 1} lines
          </span>
          <span className="ml-auto text-[9px] font-mono text-zinc-700">ESC to close</span>
        </div>
      </div>
    </>
  );
};
