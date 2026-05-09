import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useFileStore } from '../../store/useFileStore';
import { useSubprogramStore } from '../../store/useSubprogramStore';

export const Breadcrumbs: React.FC = () => {
  const { files, activeFileId } = useFileStore();
  const { subprograms, selectedSubprogramId } = useSubprogramStore();

  const activeFile = files.find((f) => f.id === activeFileId);
  const selectedSub = subprograms.find((s) => s.id === selectedSubprogramId);

  // Derive package name from file name
  const packageName = activeFile
    ? activeFile.name.replace(/\.(ads|adb)$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const crumbs = [
    activeFile ? activeFile.name : null,
    packageName ? `Package ${packageName}` : null,
    selectedSub ? selectedSub.name : null,
  ].filter(Boolean) as string[];

  if (crumbs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs font-mono text-zinc-500 overflow-hidden">
      {crumbs.map((crumb, i) => (
        <React.Fragment key={crumb}>
          {i > 0 && <ChevronRight size={10} className="text-zinc-700 flex-shrink-0" />}
          <span
            className={`truncate ${i === crumbs.length - 1 ? 'text-zinc-300' : 'text-zinc-600'}`}
          >
            {crumb}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};
