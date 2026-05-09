import React, { useState } from 'react';
import { FileCode, FolderOpen, FolderClosed, RefreshCw, X, Eye, Clock, Play, CheckCircle } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useParseStore } from '../../store/useParseStore';
import { FileStatusBadge } from './FileStatusBadge';
import { Badge } from '../shared/Badge';
import { EmptyState } from '../shared/EmptyState';
import { AdaFile } from '../../types/file.types';
import { analyzeAdaSource } from '../../utils/adaAnalyzer';
import { showToast } from '../shared/Toast';

// ── Single file row ──────────────────────────────────────────────────────────
const FileRow: React.FC<{ file: AdaFile; indent?: boolean; onParseClick: (file: AdaFile) => void }> = ({
  file, indent = false, onParseClick,
}) => {
  const { activeFileId, setActiveFile, removeFile } = useFileStore();
  const { openTab, setActiveTab } = useEditorStore();
  const { results } = useParseStore();
  const isActive = file.id === activeFileId;
  const isParsed = !!results[file.id];
  const [parsing, setParsing] = useState(false);

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

  const handleParse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setParsing(true);
    setTimeout(() => {
      onParseClick(file);
      setParsing(false);
    }, 300);
  };

  return (
    <div
      onClick={handleOpen}
      className={`group flex items-center gap-2 py-2 cursor-pointer transition-all border-l-2 ${
        indent ? '' : 'px-3'
      } ${
        isActive
          ? 'border-yellow-400 bg-yellow-400/5 text-zinc-200'
          : 'border-transparent hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
      }`}
      style={indent ? { paddingLeft: 28 } : {}}
    >
      <FileCode size={12} style={{ color: isActive ? '#facc15' : '#52525b', flexShrink: 0 }} />
      <span className="flex-1 text-xs font-mono truncate" title={file.relativePath ?? file.name}>
        {file.name}
      </span>

      {/* Parse status */}
      {isParsed && (
        <span title="Parsed — JSON ready">
          <CheckCircle size={11} style={{ color: '#4ade80', flexShrink: 0 }} />
        </span>
      )}
      <FileStatusBadge status={file.status} />

      {/* Parse button */}
      <button
        onClick={handleParse}
        title="Parse this file → view JSON"
        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-semibold transition-all flex-shrink-0"
        style={{
          background: isParsed ? 'rgba(74,222,128,0.12)' : 'rgba(250,204,21,0.12)',
          color: isParsed ? '#4ade80' : '#facc15',
          border: `1px solid ${isParsed ? 'rgba(74,222,128,0.3)' : 'rgba(250,204,21,0.3)'}`,
        }}
      >
        {parsing ? (
          <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full spin inline-block" />
        ) : (
          <Play size={8} />
        )}
        {isParsed ? 'Re-parse' : 'Parse'}
      </button>

      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); handleOpen(); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300" title="Open in editor">
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
const FolderGroup: React.FC<{
  folderId: string;
  folderName: string;
  folderFiles: AdaFile[];
  onParseClick: (file: AdaFile) => void;
}> = ({ folderId, folderName, folderFiles, onParseClick }) => {
  const [open, setOpen] = useState(true);
  const { removeFolder } = useFileStore();
  const isLarge = folderFiles.length > 30;

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
        {isLarge && <span className="text-[9px] font-mono text-amber-500/70">⚠ {folderFiles.length}</span>}
        {!isLarge && <span className="text-[10px] font-mono text-zinc-600">{folderFiles.length}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); removeFolder(folderId); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-all"
        >
          <X size={10} />
        </button>
      </div>
      {open && folderFiles.map((f) => (
        <FileRow key={f.id} file={f} indent onParseClick={onParseClick} />
      ))}
    </div>
  );
};

// ── Main FileManager ─────────────────────────────────────────────────────────
export const FileManager: React.FC = () => {
  const { files, folders } = useFileStore();
  const { openFileTabs } = useEditorStore();
  const { setResult, setActiveResult } = useParseStore();

  const looseFiles = files.filter((f) => !f.folderId);
  const specFiles = looseFiles.filter((f) => f.type === 'spec');
  const bodyFiles = looseFiles.filter((f) => f.type === 'body');

  const recentFiles = openFileTabs
    .slice().reverse().slice(0, 3)
    .map((id) => files.find((f) => f.id === id))
    .filter(Boolean) as AdaFile[];

  const handleParseClick = (file: AdaFile) => {
    try {
      const analysis = analyzeAdaSource(file.content, file.name, file.type);
      const jsonText = JSON.stringify(analysis, null, 2);

      // Extract subprograms from the index for this file
      const subEntries = analysis.subprogram_index[file.name] ?? [];
      const subprograms = subEntries.map((s) => ({
        id: `${file.id}_${s.name}_${s.start_line}`,
        fileId: file.id,
        name: s.name,
        kind: (s.return_type ? 'function' : 'procedure') as 'function' | 'procedure',
        parameters: s.parameters.map((p) => {
          const parts = p.split(':').map((x) => x.trim());
          const namePart = parts[0] ?? 'param';
          const typePart = parts[1] ?? 'Unknown';
          const modeMatch = /^(in\s+out|in|out)\s+(.+)$/i.exec(typePart);
          return {
            name: namePart,
            paramType: modeMatch ? modeMatch[2].trim() : typePart,
            mode: (modeMatch ? modeMatch[1].toLowerCase().trim() : 'in') as 'in' | 'out' | 'in out',
          };
        }),
        returnType: s.return_type ?? undefined,
        startLine: s.start_line,
        endLine: s.end_line,
        testCount: 0,
      }));

      const subCount = subEntries.length;
      const varCount = Object.values(analysis.variables_info[file.name]?.local_variables ?? {})
        .reduce((acc, v) => acc + Object.keys(v).length, 0);
      const callEdges = Object.values(analysis.call_graph).reduce((a, v) => a + v.length, 0);
      const deadCount = analysis.dead_code.length;

      setResult(file.id, { fileId: file.id, fileName: file.name, parsedAt: new Date().toISOString(), subprograms, analysis, jsonText });
      setActiveResult(file.id);
      showToast(
        `Parsed ${subCount} subprogram(s) · ${varCount} local vars · ${callEdges} call edges · ${deadCount} dead code`,
        'success'
      );
    } catch (err) {
      showToast(`Parse failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  return (
    <div className="flex flex-col">
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
          {recentFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest flex items-center gap-1">
                <Clock size={8} /> Recent
              </p>
              {recentFiles.map((f) => (
                <FileRow key={`recent_${f.id}`} file={f} onParseClick={handleParseClick} />
              ))}
            </div>
          )}

          {folders.map((folder) => {
            const folderFiles = files.filter((f) => f.folderId === folder.id);
            return (
              <FolderGroup
                key={folder.id}
                folderId={folder.id}
                folderName={folder.name}
                folderFiles={folderFiles}
                onParseClick={handleParseClick}
              />
            );
          })}

          {specFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                Specification (.ads)
              </p>
              {specFiles.map((f) => (
                <FileRow key={f.id} file={f} onParseClick={handleParseClick} />
              ))}
            </div>
          )}

          {bodyFiles.length > 0 && (
            <div>
              <p className="px-3 py-1 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                Body (.adb)
              </p>
              {bodyFiles.map((f) => (
                <FileRow key={f.id} file={f} onParseClick={handleParseClick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
