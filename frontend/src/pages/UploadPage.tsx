import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, ArrowRight, Zap } from 'lucide-react';
import { FileDropzone } from '../components/upload/FileDropzone';
import { FilePreviewCard } from '../components/upload/FilePreviewCard';
import { FolderPreviewCard } from '../components/upload/FolderPreviewCard';
import { SettingsToggle } from '../components/upload/SettingsToggle';
import { Button } from '../components/shared/Button';
import { useFileStore } from '../store/useFileStore';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { files, folders } = useFileStore();

  // loose files = files not belonging to any folder
  const looseFiles = files.filter((f) => !f.folderId);

  const handleContinue = () => {
    navigate('/editor');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="glass rounded-2xl w-full max-w-[680px] p-8 flex flex-col gap-6"
        style={{
          background: 'rgba(22,22,26,0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid #27272a',
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Diamond size={24} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 font-mono">
              Ada Analysis & Test Generation Tool
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Upload Ada source files to analyze subprograms and auto-generate test cases
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-600 font-mono">
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-amber-500" /> Static Analysis
            </span>
            <span className="text-zinc-700">·</span>
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-amber-500" /> Test Generation
            </span>
            <span className="text-zinc-700">·</span>
            <span className="flex items-center gap-1">
              <Zap size={10} className="text-amber-500" /> Call Graph
            </span>
          </div>
        </div>

        {/* Dropzone */}
        <FileDropzone />

        {/* File previews — loose files */}
        {looseFiles.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Files ({looseFiles.length})
            </p>
            {looseFiles.map((file, idx) => (
              <FilePreviewCard key={file.id} file={file} index={idx} />
            ))}
          </div>
        )}

        {/* Folder previews */}
        {folders.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              Folders ({folders.length})
            </p>
            {folders.map((folder, idx) => (
              <FolderPreviewCard key={folder.id} folder={folder} index={idx} />
            ))}
          </div>
        )}

        {/* Settings */}
        <SettingsToggle />

        {/* Continue button */}
        <Button
          variant="primary"
          size="lg"
          className="w-full justify-center"
          disabled={files.length === 0 && folders.length === 0}
          onClick={handleContinue}
          icon={<ArrowRight size={16} />}
        >
          Continue to Editor
        </Button>

        {/* Demo hint */}
        <p className="text-center text-xs text-zinc-600">
          No files? The editor loads with demo Ada calculator code automatically.{' '}
          <button
            onClick={handleContinue}
            className="text-amber-500/70 hover:text-amber-400 underline transition-colors"
          >
            Skip to demo
          </button>
        </p>
      </div>
    </div>
  );
};

export default UploadPage;
