import React, { useEffect, useRef } from 'react';
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

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, subprogramId, onClose }) => {
  const { setActiveTab, navigateTo, openTab } = useEditorStore();
  const { subprograms, selectSubprogram } = useSubprogramStore();
  const { setCurrentTests } = useTestCaseStore();
  const { setActiveFile } = useFileStore();
  const menuRef = useRef<HTMLDivElement>(null);

  const sub = subprograms.find((s) => s.id === subprogramId);

  // Menu dimensions for viewport clamping
  const MENU_W = 260;
  const MENU_H = 280;
  const left = x + MENU_W > window.innerWidth ? x - MENU_W : x;
  const top  = y + MENU_H > window.innerHeight ? y - MENU_H : y;

  // Close on Escape or outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!sub) return null;

  const run = (action: () => void) => { action(); onClose(); };

  const items = [
    {
      label: 'Generate Test Case',
      action: () => {
        const tests = generateTestCases(sub);
        setCurrentTests(subprogramId, tests);
        selectSubprogram(subprogramId);
        setActiveTab('tests');
        showToast(`Generated ${tests.length} test cases for ${sub.name}`, 'success');
      },
    },
    {
      label: 'View Variables',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      label: 'Show Parameters',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveFile(sub.fileId);
        openTab(sub.fileId);
        setActiveTab('code');
        setTimeout(() => navigateTo(sub.startLine, sub.fileId, sub.id), 80);
        showToast(
          sub.parameters.length === 0
            ? `${sub.name} has no parameters`
            : `${sub.name}(${sub.parameters.map((p) => `${p.name}: ${p.paramType}`).join(', ')})`,
          'info'
        );
      },
    },
    {
      label: 'Coverage Report',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      label: 'Call Graph',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('graph');
      },
    },
    {
      label: 'Dead Code Analysis',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9997]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* Menu */}
      <div
        ref={menuRef}
        className="context-menu-enter fixed z-[9998] overflow-hidden"
        style={{
          left,
          top,
          width: MENU_W,
          background: '#111111',
          border: '1px solid #2a2a2a',
          borderRadius: 8,
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subprogram label at top */}
        <div
          className="px-4 py-2.5"
          style={{ borderBottom: '1px solid #1e1e1e', background: '#0d0d0d' }}
        >
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#52525b' }}>
            {sub.kind}
          </p>
          <p className="text-sm font-mono font-semibold mt-0.5 truncate" style={{ color: '#facc15' }}>
            {sub.name}
          </p>
        </div>

        {/* Items */}
        <div className="py-1">
          {items.map((item, i) => (
            <button
              key={item.label}
              onClick={() => run(item.action)}
              className="w-full text-left px-4 py-3 text-sm font-medium transition-colors"
              style={{ color: '#d4d4d8', background: 'transparent' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a';
                (e.currentTarget as HTMLButtonElement).style.color = '#facc15';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = '#d4d4d8';
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
