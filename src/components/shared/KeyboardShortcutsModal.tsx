import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { category: 'Navigation', items: [
    { keys: ['Ctrl', 'K'], label: 'Open Command Palette' },
    { keys: ['Ctrl', 'Shift', 'T'], label: 'Switch to Test Cases tab' },
    { keys: ['Ctrl', 'Shift', 'G'], label: 'Switch to Call Graph tab' },
    { keys: ['Ctrl', 'Shift', 'P'], label: 'Focus Subprogram Search' },
    { keys: ['Ctrl', '\\'], label: 'Toggle Right Panel' },
    { keys: ['Ctrl', '`'], label: 'Toggle Bottom Panel' },
  ]},
  { category: 'Editor', items: [
    { keys: ['Ctrl', 'H'], label: 'Find & Replace' },
    { keys: ['Ctrl', 'F'], label: 'Find in file' },
    { keys: ['Ctrl', '+'], label: 'Increase font size' },
    { keys: ['Ctrl', '-'], label: 'Decrease font size' },
    { keys: ['Ctrl', 'M'], label: 'Toggle minimap' },
  ]},
  { category: 'Tests', items: [
    { keys: ['Ctrl', 'Enter'], label: 'Run selected test' },
    { keys: ['Ctrl', 'E'], label: 'Export current tests as JSON' },
    { keys: ['F2'], label: 'Rename/tag history item' },
  ]},
  { category: 'General', items: [
    { keys: ['Escape'], label: 'Close modal / context menu' },
    { keys: ['?'], label: 'Open this shortcuts panel' },
  ]},
];

export const KeyboardShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9994] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden context-menu-enter"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <Keyboard size={15} className="text-amber-400" />
          <span className="text-sm font-mono font-semibold text-zinc-200">Keyboard Shortcuts</span>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 grid grid-cols-2 gap-4" style={{ maxHeight: 480 }}>
          {shortcuts.map((section) => (
            <div key={section.category}>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">
                {section.category}
              </p>
              <div className="flex flex-col gap-1.5">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">{item.label}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 && <span className="text-zinc-700 text-[10px]">+</span>}
                          <kbd className="text-[9px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
