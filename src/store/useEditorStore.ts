import { create } from 'zustand';

export type EditorTab = 'code' | 'tests' | 'analysis' | 'graph';

interface HighlightRange {
  start: number;
  end: number;
}

interface CursorPosition {
  line: number;
  col: number;
}

interface EditorStore {
  activeTab: EditorTab;
  openFileTabs: string[];
  cursorPosition: CursorPosition;
  highlightRange: HighlightRange | null;
  rightPanelCollapsed: boolean;
  bottomPanelCollapsed: boolean;
  setActiveTab: (tab: EditorTab) => void;
  openTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  setHighlight: (range: HighlightRange | null) => void;
  setCursorPosition: (pos: CursorPosition) => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  activeTab: 'tests',
  openFileTabs: [],
  cursorPosition: { line: 1, col: 1 },
  highlightRange: null,
  rightPanelCollapsed: false,
  bottomPanelCollapsed: false,

  setActiveTab: (tab) => set({ activeTab: tab }),

  openTab: (fileId) =>
    set((state) => ({
      openFileTabs: state.openFileTabs.includes(fileId)
        ? state.openFileTabs
        : [...state.openFileTabs, fileId],
    })),

  closeTab: (fileId) =>
    set((state) => ({
      openFileTabs: state.openFileTabs.filter((id) => id !== fileId),
    })),

  setHighlight: (range) => set({ highlightRange: range }),

  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),

  toggleBottomPanel: () =>
    set((state) => ({ bottomPanelCollapsed: !state.bottomPanelCollapsed })),
}));
