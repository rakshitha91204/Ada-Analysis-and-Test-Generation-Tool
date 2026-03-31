import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useFileStore } from '../../store/useFileStore';
import { generateTestCases } from '../../utils/testCaseGenerator';
import { showToast } from '../shared/Toast';
import { ParametersModal } from './ParametersModal';

interface ContextMenuProps {
  x: number;
  y: number;
  subprogramId: string;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, subprogramId, onClose }) => {
  const { setActiveTab, navigateTo, openTab } = useEditorStore();
  const { subprograms, selectSubprogram } = useSubprogramStore();
  const { setCurrentTests, currentTestSets } = useTestCaseStore();
  const { setActiveFile } = useFileStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showParams, setShowParams] = useState(false);

  const sub = subprograms.find((s) => s.id === subprogramId);
  const existingTests = sub ? (currentTestSets[sub.id] || []) : [];

  const MENU_W = 260;
  const MENU_H = 320;
  const left = x + MENU_W > window.innerWidth ? x - MENU_W : x;
  const top  = y + MENU_H > window.innerHeight ? y - MENU_H : y;

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
      sublabel: existingTests.length > 0 ? `Regenerate (${existingTests.length} exist)` : 'Auto-generate tests',
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
      sublabel: 'Static analysis output',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      label: 'Show Parameters',
      sublabel: sub.parameters.length === 0 ? 'No parameters' : `${sub.parameters.length} parameter${sub.parameters.length !== 1 ? 's' : ''}`,
      action: () => {
        setShowParams(true);
        // Don't close the menu — modal will handle close
      },
      keepOpen: true,
    },
    {
      label: 'Coverage Report',
      sublabel: existingTests.length > 0
        ? `${existingTests.filter((t) => t.runStatus === 'pass').length}/${existingTests.length} passing`
        : 'No tests yet',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      label: 'Call Graph',
      sublabel: 'Visualize call relationships',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('graph');
      },
    },
    {
      label: 'Dead Code Analysis',
      sublabel: 'Find unreachable branches',
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
        {/* Header */}
        <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #1e1e1e', background: '#0d0d0d' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#52525b' }}>
            {sub.kind} · L{sub.startLine}
          </p>
          <p className="text-sm font-mono font-semibold mt-0.5 truncate" style={{ color: '#facc15' }}>
            {sub.name}
          </p>
        </div>

        {/* Items */}
        <div className="py-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                if (item.keepOpen) { item.action(); }
                else { run(item.action); }
              }}
              className="w-full text-left px-4 py-2.5 transition-colors group"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <p className="text-sm font-medium transition-colors" style={{ color: '#d4d4d8' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLParagraphElement).style.color = '#facc15'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLParagraphElement).style.color = '#d4d4d8'; }}
              >
                {item.label}
              </p>
              {item.sublabel && (
                <p className="text-[10px] font-mono mt-0.5" style={{ color: '#52525b' }}>
                  {item.sublabel}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2" style={{ borderTop: '1px solid #1e1e1e' }}>
          <p className="text-[9px] font-mono" style={{ color: '#3f3f46' }}>ESC to close</p>
        </div>
      </div>

      {/* Parameters modal */}
      {showParams && (
        <ParametersModal
          sub={sub}
          onClose={() => { setShowParams(false); onClose(); }}
        />
      )}
    </>
  );
};
