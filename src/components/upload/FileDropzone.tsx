import React, { useCallback, useRef } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, FileCode, FolderOpen } from 'lucide-react';
import { AdaFile, AdaFolder, FileType } from '../../types/file.types';
import { showToast } from '../shared/Toast';
import { useFileStore } from '../../store/useFileStore';

const MAX_FOLDER_FILES = 30;

function getFileType(name: string): FileType | null {
  if (name.endsWith('.ads')) return 'spec';
  if (name.endsWith('.adb')) return 'body';
  return null;
}

function buildAdaFile(
  file: File,
  content: string,
  folderId?: string,
  folderName?: string,
  relativePath?: string
): AdaFile {
  const fileType = getFileType(file.name)!;
  return {
    id: `file_${(folderId ?? '') + file.name.replace(/\W/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: file.name,
    content,
    type: fileType,
    status: 'pending',
    uploadedAt: new Date().toISOString(),
    folderId,
    folderName,
    relativePath,
  };
}

export const FileDropzone: React.FC = () => {
  const { files, addFiles, addFolder } = useFileStore();
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ── Handle files dropped / selected via react-dropzone ──────────────────
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        showToast('Only .adb and .ads files are accepted', 'error');
      }
      processLooseFiles(accepted);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files]
  );

  function processLooseFiles(accepted: File[]) {
    const adaFiles = accepted.filter((f) => getFileType(f.name));
    const invalid = accepted.filter((f) => !getFileType(f.name));
    if (invalid.length) showToast(`Skipped ${invalid.length} non-Ada file(s)`, 'warning');

    for (const file of adaFiles) {
      const isDuplicate = files.some((f) => f.name === file.name && !f.folderId);
      if (isDuplicate) showToast(`Duplicate: ${file.name} — replacing`, 'warning');
      const reader = new FileReader();
      reader.onload = (e) => {
        addFiles([buildAdaFile(file, e.target?.result as string)]);
      };
      reader.readAsText(file);
    }
  }

  // ── Handle folder selected via hidden <input webkitdirectory> ────────────
  const handleFolderInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawFiles = Array.from(e.target.files ?? []);
      if (rawFiles.length === 0) return;

      // Derive folder name from the first file's webkitRelativePath
      const folderName =
        (rawFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] ??
        'folder';
      const folderId = `folder_${folderName}_${Date.now()}`;

      const adaFiles = rawFiles.filter((f) => getFileType(f.name));
      const skipped = rawFiles.length - adaFiles.length;

      if (adaFiles.length === 0) {
        showToast(`No .adb or .ads files found in "${folderName}"`, 'error');
        e.target.value = '';
        return;
      }

      if (adaFiles.length > MAX_FOLDER_FILES) {
        showToast(
          `"${folderName}" has ${adaFiles.length} Ada files (>${MAX_FOLDER_FILES}). All will be loaded — this may be slow.`,
          'warning'
        );
      }

      if (skipped > 0) {
        showToast(`Skipped ${skipped} non-Ada file(s) in "${folderName}"`, 'info' as const);
      }

      const fileIds: string[] = [];
      let loaded = 0;
      const builtFiles: AdaFile[] = [];

      for (const file of adaFiles) {
        const relativePath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const adaFile = buildAdaFile(
            file,
            ev.target?.result as string,
            folderId,
            folderName,
            relativePath
          );
          fileIds.push(adaFile.id);
          builtFiles.push(adaFile);
          loaded++;
          if (loaded === adaFiles.length) {
            addFiles(builtFiles);
            addFolder({ id: folderId, name: folderName, fileIds, uploadedAt: new Date().toISOString() });
            showToast(`Loaded ${adaFiles.length} files from "${folderName}"`, 'success');
          }
        };
        reader.readAsText(file);
      }

      e.target.value = '';
    },
    [addFiles, addFolder]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.adb', '.ads'],
      'application/octet-stream': ['.adb', '.ads'],
    },
    multiple: true,
    noClick: false,
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Main drop area */}
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-amber-500 dropzone-active'
            : 'border-zinc-700 hover:border-amber-500/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`p-3 rounded-full transition-colors ${isDragActive ? 'bg-amber-500/20' : 'bg-zinc-800'}`}>
            {isDragActive ? (
              <FileCode size={26} className="text-amber-400" />
            ) : (
              <Upload size={26} className="text-zinc-400" />
            )}
          </div>
          <div>
            <p className="text-zinc-200 font-medium text-sm">
              {isDragActive ? 'Drop here' : 'Drag & drop .adb or .ads files'}
            </p>
            <p className="text-zinc-500 text-xs mt-1">or click to browse individual files</p>
          </div>
          <p className="text-zinc-600 text-xs font-mono">
            Accepts: .ads (specification) · .adb (body)
          </p>
        </div>
      </div>

      {/* Folder upload button */}
      <button
        type="button"
        onClick={() => folderInputRef.current?.click()}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-xs font-medium hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/5 transition-all"
      >
        <FolderOpen size={14} />
        Upload entire folder
        <span className="text-zinc-600 font-mono text-[10px]">(scans for .adb / .ads)</span>
      </button>

      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        multiple
        className="hidden"
        onChange={handleFolderInput}
      />
    </div>
  );
};
