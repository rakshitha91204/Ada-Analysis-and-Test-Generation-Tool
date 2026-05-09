import { create } from 'zustand';
import { AdaFile, AdaFolder, FileStatus } from '../types/file.types';
import { saveSession } from '../utils/sessionStorage';

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
  loadFromSession: (files: AdaFile[], folders: AdaFolder[], activeFileId: string | null) => void;
}

function persist(files: AdaFile[], folders: AdaFolder[], activeFileId: string | null) {
  // Debounce saves to avoid hammering localStorage on rapid changes
  clearTimeout((persist as unknown as { _t?: ReturnType<typeof setTimeout> })._t);
  (persist as unknown as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
    saveSession(files, folders, activeFileId);
  }, 800);
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  folders: [],
  activeFileId: null,

  addFiles: (newFiles) =>
    set((state) => {
      const merged = [
        ...state.files,
        ...newFiles.filter((f) => !state.files.some((e) => e.id === f.id)),
      ];
      persist(merged, state.folders, state.activeFileId);
      return { files: merged };
    }),

  removeFile: (id) =>
    set((state) => {
      const files = state.files.filter((f) => f.id !== id);
      const activeFileId = state.activeFileId === id ? null : state.activeFileId;
      persist(files, state.folders, activeFileId);
      return { files, activeFileId };
    }),

  replaceFile: (id, file) =>
    set((state) => {
      const files = state.files.map((f) => (f.id === id ? file : f));
      persist(files, state.folders, state.activeFileId);
      return { files };
    }),

  setActiveFile: (id) => {
    set({ activeFileId: id });
    const { files, folders } = get();
    persist(files, folders, id);
  },

  updateFileStatus: (id, status, errorMessage) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, status, errorMessage } : f)),
    })),

  addFolder: (folder) =>
    set((state) => {
      const folders = [...state.folders.filter((f) => f.id !== folder.id), folder];
      persist(state.files, folders, state.activeFileId);
      return { folders };
    }),

  removeFolder: (folderId) =>
    set((state) => {
      const folders = state.folders.filter((f) => f.id !== folderId);
      const files = state.files.filter((f) => f.folderId !== folderId);
      const activeFileId = state.files.find(
        (f) => f.folderId === folderId && f.id === state.activeFileId
      ) ? null : state.activeFileId;
      persist(files, folders, activeFileId);
      return { folders, files, activeFileId };
    }),

  loadFromSession: (files, folders, activeFileId) =>
    set({ files, folders, activeFileId }),
}));
