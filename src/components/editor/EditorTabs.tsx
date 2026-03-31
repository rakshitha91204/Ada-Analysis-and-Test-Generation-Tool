import React from 'react';
import { X, FileCode } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';

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
        return (
          <div
            key={file.id}
            onClick={() => setActiveFile(file.id)}
            className={`group flex items-center gap-2 px-4 py-2 text-xs font-mono cursor-pointer transition-all border-b-2 whitespace-nowrap ${
              isActive
                ? 'text-zinc-200 border-amber-500 bg-zinc-900/50'
                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/30'
            }`}
          >
            <FileCode size={12} className={isActive ? 'text-amber-400' : 'text-zinc-600'} />
            <span>{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(file.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all ml-1"
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
