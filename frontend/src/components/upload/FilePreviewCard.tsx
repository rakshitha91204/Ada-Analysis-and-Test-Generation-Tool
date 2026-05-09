import React from 'react';
import { FileCode, X, RefreshCw } from 'lucide-react';
import { AdaFile } from '../../types/file.types';
import { Badge } from '../shared/Badge';
import { useFileStore } from '../../store/useFileStore';

interface FilePreviewCardProps {
  file: AdaFile;
  index: number;
}

export const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, index }) => {
  const { removeFile } = useFileStore();

  const handleReplace = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.adb,.ads';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const { replaceFile } = useFileStore.getState();
        replaceFile(file.id, {
          ...file,
          name: f.name,
          content,
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
      className="slide-up flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50 hover:border-zinc-600 transition-all"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-1.5 rounded bg-zinc-700/50">
        <FileCode size={16} className="text-zinc-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-zinc-200 text-sm font-mono truncate">{file.name}</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          {file.content.split('\n').length} lines
        </p>
      </div>

      <Badge variant={file.type === 'spec' ? 'primary' : 'secondary'}>
        {file.type === 'spec' ? 'SPEC' : 'BODY'}
      </Badge>

      <div className="flex items-center gap-1">
        <button
          onClick={handleReplace}
          title="Replace file"
          className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={() => removeFile(file.id)}
          title="Remove file"
          className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
