import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description }) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div className="relative flex-shrink-0">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <div className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-amber-500' : 'bg-zinc-700'}`} />
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
    <div>
      <p className="text-zinc-200 text-sm font-medium">{label}</p>
      <p className="text-zinc-500 text-xs">{description}</p>
    </div>
  </label>
);

export const SettingsToggle: React.FC = () => {
  const [open, setOpen] = useState(false);
  const {
    enableTestGen, setEnableTestGen,
    enableStaticAnalysis, setEnableStaticAnalysis,
    minimapEnabled, setMinimapEnabled,
    splitEditor, setSplitEditor,
    fontSize, setFontSize,
    theme, setTheme,
  } = useSettingsStore();

  return (
    <div className="rounded-lg border border-zinc-700/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
      >
        <Settings size={14} />
        <span className="flex-1 text-left font-medium">Analysis Settings</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      <div
        className="accordion-content"
        style={{ maxHeight: open ? '400px' : '0', opacity: open ? 1 : 0 }}
      >
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-zinc-700/50">
          <Toggle checked={enableTestGen} onChange={setEnableTestGen}
            label="Auto Test Generation" description="Generate test cases on subprogram selection" />
          <Toggle checked={enableStaticAnalysis} onChange={setEnableStaticAnalysis}
            label="Static Analysis" description="Run diagnostics and dead code detection" />
          <Toggle checked={minimapEnabled} onChange={setMinimapEnabled}
            label="Show Minimap" description="Monaco editor minimap overview" />
          <Toggle checked={splitEditor} onChange={setSplitEditor}
            label="Split Editor Pane" description="Show two files side by side" />

          {/* Font size */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-zinc-200 text-sm font-medium">Editor Font Size</p>
              <p className="text-zinc-500 text-xs">Current: {fontSize}px</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setFontSize(fontSize - 1)}
                className="w-7 h-7 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 text-sm font-bold transition-colors">−</button>
              <span className="text-xs font-mono text-zinc-300 w-6 text-center">{fontSize}</span>
              <button onClick={() => setFontSize(fontSize + 1)}
                className="w-7 h-7 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 text-sm font-bold transition-colors">+</button>
            </div>
          </div>

          {/* Theme */}
          <div>
            <p className="text-zinc-200 text-sm font-medium mb-2">Editor Theme</p>
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'ada-purple', label: 'Purple', dot: '#c586c0' },
                { id: 'ada-dark',   label: 'Amber',  dot: '#f59e0b' },
                { id: 'ada-soft',   label: 'Soft',   dot: '#fbbf24' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                    theme === t.id
                      ? 'bg-zinc-700 text-zinc-100 border border-zinc-500'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.dot }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
