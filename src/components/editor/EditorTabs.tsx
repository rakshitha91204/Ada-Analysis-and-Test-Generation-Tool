import React from 'react';
import { X, FileCode } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';

const statusDot: Record<string, { color: string; title: string; pulse?: boolean }> = {
  pending:  { color: '#52525b', title: 'Pending' },
  parsing:  { color: '#facc15', title: 'Parsing...', pulse: true },
  parsed:   { color: '#4ade80', title: 'Parsed OK' },
  error:    { color: '#f87171', title: 'Parse error' },
};

export const EditorTabs: React.FC = () => {
  const { files, activeFileId, setActiveFile } = useFileStore();
  const { openFileTabs, closeTab } = useEditorStore();

  const tabFiles = openFileTabs
    .map((id) => files.find((f) => f.id === id))
    .filter(Boolean) as typeof files;

  if (tabFiles.length === 0) return null;

  return (
    <div
      className="flex items-end gap-0 overflow-x-auto border-b"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)', minHeight: 36 }}
    >
      {tabFiles.map((file) => {
        const isActive = file.id === activeFileId;
        const dot = statusDot[file.status] ?? statusDot.pending;

        return (
          <div
            key={file.id}
            onClick={() => setActiveFile(file.id)}
            className={`group flex items-center gap-2 px-4 py-2 text-xs font-mono cursor-pointer transition-all border-b-2 whitespace-nowrap ${
              isActive
                ? 'border-yellow-400 bg-zinc-900/50'
                : 'border-transparent hover:bg-zinc-800/30'
            }`}
          >
            <FileCode size={12} style={{ color: isActive ? '#facc15' : '#52525b' }} />
            <span style={{ color: isActive ? '#e4e4e7' : '#71717a' }}>{file.name}</span>

            {/* Status dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot.pulse ? 'spin' : ''}`}
              style={{ background: dot.color, boxShadow: `0 0 4px ${dot.color}` }}
              title={dot.title}
            />

            <button
              onClick={(e) => { e.stopPropagation(); closeTab(file.id); }}
              className="opacity-0 group-hover:opacity-100 transition-all ml-0.5"
              style={{ color: '#52525b' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#52525b'; }}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
