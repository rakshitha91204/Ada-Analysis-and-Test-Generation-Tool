import React from 'react';
import {
  Variable,
  List,
  TestTube,
  BarChart2,
  GitBranch,
  AlertTriangle,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { generateTestCases } from '../../utils/testCaseGenerator';

interface ContextMenuProps {
  x: number;
  y: number;
  subprogramId: string;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, subprogramId, onClose }) => {
  const { setActiveTab } = useEditorStore();
  const { subprograms, selectSubprogram } = useSubprogramStore();
  const { setCurrentTests } = useTestCaseStore();

  const sub = subprograms.find((s) => s.id === subprogramId);

  const menuItems = [
    {
      icon: <Variable size={13} />,
      label: 'View Variables',
      shortcut: '',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      icon: <List size={13} />,
      label: 'Show Parameters',
      shortcut: '',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('tests');
      },
    },
    {
      icon: <TestTube size={13} />,
      label: 'Generate Test Case',
      shortcut: 'Ctrl+Enter',
      action: () => {
        if (sub) {
          const tests = generateTestCases(sub);
          setCurrentTests(subprogramId, tests);
          selectSubprogram(subprogramId);
          setActiveTab('tests');
        }
      },
    },
    {
      icon: <BarChart2 size={13} />,
      label: 'Coverage Report',
      shortcut: '',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
    {
      icon: <GitBranch size={13} />,
      label: 'Call Graph',
      shortcut: 'Ctrl+Shift+G',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('graph');
      },
    },
    {
      icon: <AlertTriangle size={13} />,
      label: 'Dead Code Analysis',
      shortcut: '',
      action: () => {
        selectSubprogram(subprogramId);
        setActiveTab('analysis');
      },
    },
  ];

  // Adjust position to stay in viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - menuItems.length * 36 - 16);

  return (
    <div
      className="context-menu-enter fixed z-[9998] py-1 rounded-lg shadow-2xl border overflow-hidden"
      style={{
        left: adjustedX,
        top: adjustedY,
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-default)',
        minWidth: 210,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {sub && (
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            {sub.kind}
          </p>
          <p className="text-xs font-mono text-amber-400 font-semibold">{sub.name}</p>
        </div>
      )}
      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.action();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700/50 hover:text-zinc-100 transition-colors text-left"
        >
          <span className="text-zinc-500">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.shortcut && (
            <span className="text-[9px] font-mono text-zinc-600">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
};
