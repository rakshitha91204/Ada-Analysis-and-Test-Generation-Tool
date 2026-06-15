import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Diamond, ArrowRight, FolderOpen, Plus, Trash2, Edit2,
  Clock, FileCode, Check, X, ChevronRight, Zap,
} from 'lucide-react';
import { FileDropzone } from '../components/upload/FileDropzone';
import { FilePreviewCard } from '../components/upload/FilePreviewCard';
import { FolderPreviewCard } from '../components/upload/FolderPreviewCard';
import { Button } from '../components/shared/Button';
import { useFileStore } from '../store/useFileStore';
import { useProjectStore, ProjectMeta } from '../store/useProjectStore';
import { showToast } from '../components/shared/Toast';
import { format } from 'date-fns';

// ── Time formatting ───────────────────────────────────────────────────────────
function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return format(d, 'MMM d, yyyy');
  } catch { return '—'; }
}

// ── Project row ───────────────────────────────────────────────────────────────
const ProjectRow: React.FC<{
  project: ProjectMeta;
  isActive: boolean;
  onOpen: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}> = ({ project, isActive, onOpen, onDelete, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    if (newName.trim() && newName.trim() !== project.name) {
      onRename(project.name, newName.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className="group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
      style={{
        background: isActive ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.06)'}`,
      }}
      onClick={() => !editing && onOpen(project.name)}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
        style={{ background: isActive ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)' }}>
        <FolderOpen size={16} style={{ color: isActive ? '#f59e0b' : '#71717a' }} />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            onClick={e => e.stopPropagation()}
            className="w-full bg-transparent border-b text-sm font-mono font-semibold focus:outline-none"
            style={{ color: 'var(--text-primary)', borderColor: 'var(--accent-primary)' }}
          />
        ) : (
          <p className="text-sm font-mono font-semibold truncate" style={{ color: isActive ? '#f59e0b' : 'var(--text-primary)' }}>
            {project.name}
          </p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <FileCode size={9} /> {project.fileCount} file{project.fileCount !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <Clock size={9} /> {formatRelative(project.lastOpenedAt)}
          </span>
        </div>
      </div>

      {isActive && (
        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
          active
        </span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); setEditing(true); setNewName(project.name); }}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,158,11,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          title="Rename project"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(project.name); }}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          title="Delete project"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Main UploadPage ───────────────────────────────────────────────────────────
const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { files, folders, addFiles, loadFromSession } = useFileStore();
  const { createProject, openProject, deleteProject, renameProject,
          projectList, activeProjectName, projectExists } = useProjectStore();

  const [projectName, setProjectName]     = useState('');
  const [nameError, setNameError]         = useState('');
  const [view, setView]                   = useState<'new' | 'recent'>('recent');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const projects = projectList();

  // If there's an active project, pre-fill the new name input
  useEffect(() => {
    if (activeProjectName) setProjectName(activeProjectName);
  }, [activeProjectName]);

  const handleCreateProject = () => {
    const name = projectName.trim();
    if (!name) { setNameError('Project name is required'); return; }
    if (projectExists(name) && name !== activeProjectName) {
      setNameError(`"${name}" already exists — open it from Recent Projects`);
      return;
    }
    setNameError('');
    createProject(name);
    showToast(`Project "${name}" created`, 'success');
    setView('recent');
  };

  const handleOpenProject = (name: string) => {
    const data = openProject(name);
    if (!data) return;
    // Restore files into FileStore
    if (data.files?.length > 0) {
      const filesWithPending = data.files.map(f => ({ ...f, status: 'pending' as const }));
      loadFromSession(filesWithPending, data.folders ?? [], data.activeFileId);
    }
    showToast(`Opened project "${name}"`, 'success');
    navigate('/editor');
  };

  const handleDeleteProject = (name: string) => {
    deleteProject(name);
    setConfirmDelete(null);
    showToast(`Project "${name}" deleted`, 'info');
  };

  const handleRenameProject = (oldName: string, newName: string) => {
    const ok = renameProject(oldName, newName);
    if (!ok) showToast(`"${newName}" already exists`, 'error');
    else showToast(`Renamed to "${newName}"`, 'success');
  };

  const handleContinue = () => {
    if (!activeProjectName) {
      // Auto-create an unnamed project if none active
      const name = `Project ${new Date().toLocaleDateString()}`;
      createProject(name);
    }
    navigate('/editor');
  };

  const looseFiles = files.filter(f => !f.folderId);

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-base)' }}>

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl p-6 w-80 flex flex-col gap-4"
            style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <p className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
              Delete "{confirmDelete}"?
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              This will permanently delete the project and all its saved files. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded-lg text-xs font-mono transition-colors"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                onClick={() => handleDeleteProject(confirmDelete)}>
                Delete
              </button>
              <button className="flex-1 py-2 rounded-lg text-xs font-mono transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[720px] flex flex-col gap-0">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Diamond size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
              Ada Analysis & Test Generation
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Create or open a project to begin
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono" style={{ color: 'var(--text-disabled)' }}>
            <span className="flex items-center gap-1"><Zap size={9} style={{ color: '#f59e0b' }} /> Static Analysis</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Zap size={9} style={{ color: '#f59e0b' }} /> Test Generation</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Zap size={9} style={{ color: '#f59e0b' }} /> Call Graph</span>
          </div>
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div className="grid gap-4" style={{ gridTemplateColumns: projects.length > 0 ? '1fr 1fr' : '1fr' }}>

          {/* ── Left: Create / New Project ─────────────────────────────────── */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl"
            style={{ background: 'rgba(22,22,26,0.95)', border: '1px solid #27272a' }}>

            <div className="flex items-center gap-2">
              <Plus size={14} style={{ color: '#f59e0b' }} />
              <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                {activeProjectName ? 'Current Project' : 'New Project'}
              </span>
            </div>

            {/* Project name input */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Project Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={projectName}
                  onChange={e => { setProjectName(e.target.value); setNameError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                  placeholder="e.g. lcd_driver_tests"
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-mono focus:outline-none"
                  style={{
                    background: 'var(--bg-hover)',
                    border: `1px solid ${nameError ? 'rgba(239,68,68,0.5)' : 'var(--border-default)'}`,
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={handleCreateProject}
                  className="px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-colors flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                  title={activeProjectName ? 'Rename project' : 'Create project'}
                >
                  {activeProjectName === projectName.trim() ? <Check size={14} /> : <Plus size={14} />}
                </button>
              </div>
              {nameError && (
                <p className="text-[10px] font-mono" style={{ color: '#f87171' }}>{nameError}</p>
              )}
              {activeProjectName && (
                <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  Active: <span style={{ color: '#f59e0b' }}>{activeProjectName}</span>
                </p>
              )}
            </div>

            {/* File dropzone */}
            <FileDropzone />

            {/* File/folder previews */}
            {looseFiles.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Files ({looseFiles.length})
                </p>
                {looseFiles.slice(0, 4).map((file, idx) => (
                  <FilePreviewCard key={file.id} file={file} index={idx} />
                ))}
                {looseFiles.length > 4 && (
                  <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    +{looseFiles.length - 4} more files
                  </p>
                )}
              </div>
            )}
            {folders.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Folders ({folders.length})
                </p>
                {folders.map((folder, idx) => (
                  <FolderPreviewCard key={folder.id} folder={folder} index={idx} />
                ))}
              </div>
            )}

            {/* Open editor button */}
            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center"
              disabled={!activeProjectName && files.length === 0 && folders.length === 0}
              onClick={handleContinue}
              icon={<ArrowRight size={15} />}
            >
              {activeProjectName ? `Open "${activeProjectName}"` : 'Open Editor'}
            </Button>

            <p className="text-center text-[10px] font-mono" style={{ color: 'var(--text-disabled)' }}>
              No files? The editor loads with demo Ada code.{' '}
              <button onClick={handleContinue} className="underline transition-colors"
                style={{ color: 'rgba(245,158,11,0.6)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>
                Skip to demo
              </button>
            </p>
          </div>

          {/* ── Right: Recent Projects ─────────────────────────────────────── */}
          {projects.length > 0 && (
            <div className="flex flex-col gap-3 p-5 rounded-2xl"
              style={{ background: 'rgba(22,22,26,0.95)', border: '1px solid #27272a' }}>

              <div className="flex items-center gap-2">
                <Clock size={13} style={{ color: '#71717a' }} />
                <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Recent Projects
                </span>
                <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>
                  {projects.length} project{projects.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 340 }}>
                {projects.map(p => (
                  <ProjectRow
                    key={p.name}
                    project={p}
                    isActive={p.name === activeProjectName}
                    onOpen={handleOpenProject}
                    onDelete={(name) => setConfirmDelete(name)}
                    onRename={handleRenameProject}
                  />
                ))}
              </div>

              <p className="text-[10px] font-mono" style={{ color: 'var(--text-disabled)' }}>
                Click a project to open it. Your files, analysis, and test history are saved automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
