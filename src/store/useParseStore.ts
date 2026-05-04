/**
 * Stores the parsed JSON output per file.
 * This is the intermediate representation between parsing and test generation.
 */
import { create } from 'zustand';
import { Subprogram } from '../types/subprogram.types';
import { AdaFullAnalysis } from '../utils/adaAnalyzer';

export interface ParsedFileResult {
  fileId: string;
  fileName: string;
  parsedAt: string;
  subprograms: Subprogram[];
  analysis: AdaFullAnalysis;
  /** The editable JSON string shown in the JSON editor panel */
  jsonText: string;
}

interface ParseStore {
  results: Record<string, ParsedFileResult>; // keyed by fileId
  activeResultFileId: string | null;
  setResult: (fileId: string, result: ParsedFileResult) => void;
  updateJsonText: (fileId: string, text: string) => void;
  setActiveResult: (fileId: string | null) => void;
  clearResult: (fileId: string) => void;
}

export const useParseStore = create<ParseStore>((set) => ({
  results: {},
  activeResultFileId: null,

  setResult: (fileId, result) =>
    set((state) => ({ results: { ...state.results, [fileId]: result } })),

  updateJsonText: (fileId, text) =>
    set((state) => ({
      results: {
        ...state.results,
        [fileId]: state.results[fileId]
          ? { ...state.results[fileId], jsonText: text }
          : state.results[fileId],
      },
    })),

  setActiveResult: (fileId) => set({ activeResultFileId: fileId }),

  clearResult: (fileId) =>
    set((state) => {
      const next = { ...state.results };
      delete next[fileId];
      return { results: next };
    }),
}));
