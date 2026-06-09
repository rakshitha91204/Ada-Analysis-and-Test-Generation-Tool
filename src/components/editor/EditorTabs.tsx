import React from 'react';
import { X, FileCode } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useParseStore } from '../../store/useParseStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';

const statusDot: Record<string, { color: string; title: string; pulse?: boolean }> = {
  pending: { color: '#52525b', title: 'Pending' },
  parsing: { color: '#facc15', title: 'Parsing…', pulse: true },
  parsed:  { color: '#4ade80', title: 'Parsed OK' },
  error:   { color: '#f87171', title: 'Parse error' },
};

export const EditorTabs: React.FC = () => {
  const { files, activeFileId, setActiveFile } = useFileStore();
  const { openFileTabs, closeTab } = useEditorStore();
  const { results, syncToFile } = useParseStore();
  const { setSubprograms } = useSubprogramStore();

  const tabFiles = openFileTabs
    .map((id) => files.find((f) => f.id === id))
    .filter(Boolean) as typeof files;

  if (tabFiles.length === 0) return null;

  const handleTabClick = (fileId: string) => {
    setActiveFile(fileId);
    syncToFile(fileId);
    // Show ONLY this file's subprograms in the explorer
    const result = results[fileId];
    if (result?.subprograms?.length) {
      setSubprograms(result.subprograms);
    }
  };

  return (
    <div className="editor-tabs">
      {tabFiles.map((file) => {
        const isActive = file.id === activeFileId;
        const dot = statusDot[file.status] ?? statusDot.pending;

        return (
          <div
            key={file.id}
            className={`editor-tab group ${isActive ? 'active' : ''}`}
            onClick={() => handleTabClick(file.id)}
            title={file.name}
          >
            <FileCode
              size={11}
              style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }}
            />
            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>

            {/* Status dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot.pulse ? 'pulse-dot' : ''}`}
              style={{ background: dot.color }}
              title={dot.title}
            />

            {/* Close button */}
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); closeTab(file.id); }}
              title="Close tab"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
