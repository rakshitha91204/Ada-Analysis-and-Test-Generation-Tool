import { create } from 'zustand';
import { AdaFile, AdaFolder, FileStatus } from '../types/file.types';

interface FileStore {
  files: AdaFile[];
  folders: AdaFolder[];
  activeFileId: string | null;
  addFiles: (files: AdaFile[]) => void;
  removeFile: (id: string) => void;
  replaceFile: (id: string, file: AdaFile) => void;
  setActiveFile: (id: string) => void;
  updateFileStatus: (id: string, status: FileStatus, errorMessage?: string) => void;
  addFolder: (folder: AdaFolder) => void;
  removeFolder: (folderId: string) => void;
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  folders: [],
  activeFileId: null,

  addFiles: (newFiles) =>
    set((state) => ({
      files: [
        ...state.files,
        ...newFiles.filter((f) => !state.files.some((existing) => existing.id === f.id)),
      ],
    })),

  removeFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      activeFileId: state.activeFileId === id ? null : state.activeFileId,
    })),

  replaceFile: (id, file) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? file : f)),
    })),

  setActiveFile: (id) => set({ activeFileId: id }),

  updateFileStatus: (id, status, errorMessage) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, status, errorMessage } : f
      ),
    })),

  addFolder: (folder) =>
    set((state) => ({
      folders: [...state.folders.filter((f) => f.id !== folder.id), folder],
    })),

  removeFolder: (folderId) =>
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== folderId),
      files: state.files.filter((f) => f.folderId !== folderId),
      activeFileId: state.files.find((f) => f.folderId === folderId && f.id === state.activeFileId)
        ? null
        : state.activeFileId,
    })),
}));
