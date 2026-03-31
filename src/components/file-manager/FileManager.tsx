import React, { useState } from 'react';
import { FileCode, FolderOpen, FolderClosed, RefreshCw, X, Eye, Clock } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { FileStatusBadge } from './FileStatusBadge';
import { Badge } from '../shared/Badge';
import { EmptyState } from '../shared/EmptyState';
import { AdaFile } from '../../types/file.types';

// ── Single file row ──────────────────────────────────────────────────────────
const FileRow: React.FC<{ file: AdaFile; indent?: boolean }> = ({ file, indent = false }) => {
  const { activeFileId, setActiveFile, removeFile } = useFileStore();
  const { openTab, setActiveTab } = useEditorStore();
  const isActive = file.id === activeFileId;

  const handleOpen = () => {
    setActiveFile(file.id);
    openTab(file.id);
    setActiveTab('code');
  };

  const handleReplace = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.adb,.ads';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        useFileStore.getState().replaceFile(file.id, {
          ...file,
          name: f.name,
          content: ev.target?.result as string,
          status: 'pending',
          uploadedAt: new Date().toISOString(),
        });
      };
      reader.readAsText(f);
    };
    input.click();
  };

  return (
    <div
      onClick={handleOpen}
      className={`group flex items-center gap-2 py-1.5 cursor-pointer transition-all border-l-2 ${
        indent ? 'pl-7' : 'px-3'
      } ${
        isActive
          ? 'border-amber-500 bg-amber-500/5 text-zinc-200'
          : 'border-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
      }`}
      style={indent ? { paddingLeft: 28 } : {}}
    >
      <FileCode size={12} className={isActive ? 'text-amber-400' : 'text-zinc-600'} />
      <span className="flex-1 text-xs font-mono truncate" title={file.relativePath ?? file.name}>
        {file.name}
      </span>
      <FileStatusBadge status={file.status} />
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); handleOpen(); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300" title="Open">
          <Eye size={10} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleReplace(); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300" title="Replace">
          <RefreshCw size={10} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
          className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400" title="Remove">
          <X size={10} />
        </button>
      </div>
    </div>
  );
};

// ── Folder group row ─────────────────────────────────────────────────────────
const FolderGroup: React.FC<{ folderId: string; folderName: string; folderFiles: AdaFile[] }> = ({
  folderId, folderName, folderFiles,
}) => {
  const [open, setOpen] = useState(true);
  const { removeFolder } = useFileStore();
  const isLarge = folderFiles.length > 30;

  return (
    <div>
      {/* Folder header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-zinc-800/40 transition-colors group"
        onClick={() => setOpen((v) => !v)}
      >
        {open
          ? <FolderOpen size={12} className="text-amber-400 flex-shrink-0" />
          : <FolderClosed size={12} className="text-amber-500/60 flex-shrink-0" />
        }
        <span className="flex-1 text-xs font-mono text-zinc-300 truncate">{folderName}</span>
        {isLarge && (
          <span className="text-[9px] font-mono text-amber-500/70">⚠ {folderFiles.length}</span>
        )}
        {!isLarge && (
          <span className="text-[10px] font-mono text-zinc-600">{folderFiles.length}</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); removeFolder(folderId); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-all"
          title="Remove folder"
        >
          <X size={10} />
        </button>
      </div>

      {/* Files inside folder */}
      {open && (
        <div>
          {folderFiles.map((f) => (
            <FileRow key={f.id} file={f} indent />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main FileManager ─────────────────────────────────────────────────────────
export const FileManager: React.FC = () => {
  const { files, folders } = useFileStore();
  const { openFileTabs, activeTab } = useEditorStore();

  const looseFiles = files.filter((f) => !f.folderId);
  const specFiles = looseFiles.filter((f) => f.type === 'spec');
  const bodyFiles = looseFiles.filter((f) => f.type === 'body');

  // Recent files = last 3 opened tabs that still exist
  const recentFiles = openFileTabs
    .slice()
    .reverse()
    .slice(0, 3)
    .map((id) => files.find((f) => f.id === id))
    .filter(Boolean) as AdaFile[];

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={12} className="text-zinc-500" />
          <span className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
            Project Files
          </span>
        </div>
        <Badge variant="muted">{files.length}</Badge>
      </div>

      {files.length === 0 && folders.length === 0 ? (
        <div className="px-3 pb-3">
          <EmptyState
            icon={<FileCode size={24} />}
            heading="No files loaded"
            action={{ label: '← Back to Upload', onClick: () => window.history.back() }}
          />
        </div>
      ) : (
        <div className="pb-1">
          {/* Recent files */}
          {recentFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                <Clock size={8} /> Recent
              </p>
              {recentFiles.map((f) => <FileRow key={`recent_${f.id}`} file={f} />)}
            </div>
          )}

          {/* Folder groups */}
          {folders.map((folder) => {
            const folderFiles = files.filter((f) => f.folderId === folder.id);
            return (
              <FolderGroup
                key={folder.id}
                folderId={folder.id}
                folderName={folder.name}
                folderFiles={folderFiles}
              />
            );
          })}

          {/* Loose spec files */}
          {specFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                Specification (.ads)
              </p>
              {specFiles.map((f) => <FileRow key={f.id} file={f} />)}
            </div>
          )}

          {/* Loose body files */}
          {bodyFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                Body (.adb)
              </p>
              {bodyFiles.map((f) => <FileRow key={f.id} file={f} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
