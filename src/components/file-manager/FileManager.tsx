import React, { useState } from 'react';
import {
  FileCode, FolderOpen, FolderClosed, RefreshCw, X,
  Clock, Loader, CheckCircle, AlertCircle,
} from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useParseStore } from '../../store/useParseStore';
import { FileStatusBadge } from './FileStatusBadge';
import { Badge } from '../shared/Badge';
import { EmptyState } from '../shared/EmptyState';
import { AdaFile } from '../../types/file.types';
import { useFileParser } from '../../hooks/useFileParser';
import { showToast } from '../shared/Toast';

// ── Single file row ──────────────────────────────────────────────────────────
const FileRow: React.FC<{ file: AdaFile; indent?: boolean }> = ({ file, indent = false }) => {
  const { activeFileId, setActiveFile, removeFile } = useFileStore();
  const { openTab, setActiveTab } = useEditorStore();
  const { results, syncToFile, clearResult } = useParseStore();
  const { parseFile } = useFileParser();
  const isActive = file.id === activeFileId;
  const isParsed = !!results[file.id];
  const isParsing = file.status === 'parsing';
  const isError = file.status === 'error';

  // Click the file row → open in editor + parse if not already parsed
  const handleClick = async () => {
    setActiveFile(file.id);
    openTab(file.id);
    setActiveTab('code');
    syncToFile(file.id);

    // Only parse if not already parsed or currently parsing
    if (!isParsed && !isParsing) {
      try {
        await parseFile(file);
      } catch {
        showToast(`Failed to parse ${file.name}`, 'error');
      }
    }
  };

  // Re-parse button (always visible when parsed, on hover otherwise)
  const handleReParse = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await parseFile(file);
    } catch {
      showToast(`Failed to parse ${file.name}`, 'error');
    }
  };

  // Replace file content
  const handleReplace = (e: React.MouseEvent) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.adb,.ads';
    input.onchange = (ev) => {
      const f = (ev.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        useFileStore.getState().replaceFile(file.id, {
          ...file,
          name: f.name,
          content: re.target?.result as string,
          status: 'pending',
          uploadedAt: new Date().toISOString(),
        });
        // Clear old parse result when file is replaced
        clearResult(file.id);
      };
      reader.readAsText(f);
    };
    input.click();
  };

  // Remove file + its JSON result
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearResult(file.id);
    removeFile(file.id);
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex items-center gap-2 py-2 cursor-pointer transition-all border-l-2 ${
        indent ? '' : 'px-3'
      } ${
        isActive
          ? 'border-yellow-400 bg-yellow-400/5 text-zinc-200'
          : 'border-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
      }`}
      style={indent ? { paddingLeft: 28 } : {}}
    >
      {/* File icon */}
      <FileCode size={12} style={{ color: isActive ? '#facc15' : '#52525b', flexShrink: 0 }} />

      {/* File name */}
      <span className="flex-1 text-xs font-mono truncate min-w-0" title={file.relativePath ?? file.name}>
        {file.name}
      </span>

      {/* Status indicators */}
      {isParsing && (
        <Loader size={11} className="animate-spin flex-shrink-0" style={{ color: '#facc15' }} />
      )}
      {isParsed && !isParsing && (
        <CheckCircle size={11} style={{ color: '#4ade80', flexShrink: 0 }} aria-label="Parsed — JSON ready" />
      )}
      {isError && !isParsing && (
        <AlertCircle size={11} style={{ color: '#f87171', flexShrink: 0 }} aria-label={file.errorMessage ?? 'Error'} />
      )}

      <FileStatusBadge status={file.status} />

      {/* Re-parse button — visible on hover */}
      {isParsed && (
        <button
          onClick={handleReParse}
          title="Re-parse"
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono transition-all flex-shrink-0"
          style={{
            background: 'rgba(74,222,128,0.1)',
            color: '#4ade80',
            border: '1px solid rgba(74,222,128,0.25)',
          }}
        >
          ↺
        </button>
      )}

      {/* Replace button — visible on hover */}
      <button
        onClick={handleReplace}
        title="Replace file"
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all flex-shrink-0"
      >
        <RefreshCw size={10} />
      </button>

      {/* Remove (✕) button — always visible on hover */}
      <button
        onClick={handleRemove}
        title="Remove file"
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
      >
        <X size={10} />
      </button>
    </div>
  );
};

// ── Folder group row ─────────────────────────────────────────────────────────
const FolderGroup: React.FC<{
  folderId: string;
  folderName: string;
  folderFiles: AdaFile[];
}> = ({ folderId, folderName, folderFiles }) => {
  const [open, setOpen] = useState(true);
  const { removeFolder, removeFile } = useFileStore();
  const { clearResult } = useParseStore();
  const isLarge = folderFiles.length > 30;

  const handleRemoveFolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear all JSON results for files in this folder
    folderFiles.forEach((f) => clearResult(f.id));
    removeFolder(folderId);
  };

  return (
    <div>
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
          onClick={handleRemoveFolder}
          title="Remove folder"
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-all"
        >
          <X size={10} />
        </button>
      </div>
      {open && folderFiles.map((f) => (
        <FileRow key={f.id} file={f} indent />
      ))}
    </div>
  );
};

// ── Main FileManager ─────────────────────────────────────────────────────────
export const FileManager: React.FC = () => {
  const { files, folders } = useFileStore();
  const { openFileTabs } = useEditorStore();

  const looseFiles = files.filter((f) => !f.folderId);
  const specFiles = looseFiles.filter((f) => f.type === 'spec');
  const bodyFiles = looseFiles.filter((f) => f.type === 'body');

  const recentFiles = openFileTabs
    .slice().reverse().slice(0, 3)
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

      {/* Hint */}
      {files.length > 0 && (
        <p className="px-3 pb-1 text-[9px] font-mono" style={{ color: '#3f3f46' }}>
          Click a file to open &amp; parse → JSON appears in JSON tab
        </p>
      )}

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
          {/* Recently opened */}
          {recentFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                <Clock size={8} /> Recent
              </p>
              {recentFiles.map((f) => (
                <FileRow key={`recent_${f.id}`} file={f} />
              ))}
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

          {/* Spec files */}
          {specFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                Specification (.ads)
              </p>
              {specFiles.map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
            </div>
          )}

          {/* Body files */}
          {bodyFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                Body (.adb)
              </p>
              {bodyFiles.map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
