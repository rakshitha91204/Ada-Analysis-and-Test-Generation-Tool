import { create } from 'zustand';
import { Subprogram } from '../types/subprogram.types';

interface SubprogramStore {
  subprograms: Subprogram[];
  selectedSubprogramId: string | null;
  setSubprograms: (subprograms: Subprogram[]) => void;
  addSubprograms: (subprograms: Subprogram[]) => void;
  selectSubprogram: (id: string | null) => void;
  updateTestCount: (id: string, count: number) => void;
  togglePin: (id: string) => void;
}

export const useSubprogramStore = create<SubprogramStore>((set) => ({
  subprograms: [],
  selectedSubprogramId: null,

  setSubprograms: (subprograms) => set({ subprograms }),

  addSubprograms: (newSubs) =>
    set((state) => ({
      subprograms: [
        ...state.subprograms.filter(
          (s) => !newSubs.some((ns) => ns.id === s.id)
        ),
        ...newSubs,
      ],
    })),

  selectSubprogram: (id) => set({ selectedSubprogramId: id }),

  updateTestCount: (id, count) =>
    set((state) => ({
      subprograms: state.subprograms.map((s) =>
        s.id === id
          ? { ...s, testCount: count, lastGeneratedAt: new Date().toISOString() }
          : s
      ),
    })),

  togglePin: (id) =>
    set((state) => ({
      subprograms: state.subprograms.map((s) =>
        s.id === id ? { ...s, pinned: !s.pinned } : s
      ),
    })),
}));
