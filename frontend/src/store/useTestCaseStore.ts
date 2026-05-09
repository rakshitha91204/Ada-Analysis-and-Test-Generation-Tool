import { create } from 'zustand';
import { TestCase, TestCaseSet } from '../types/testcase.types';
import { Subprogram, Parameter } from '../types/subprogram.types';

// ─── Inlined: storageUtils ────────────────────────────────────────────────────
const HISTORY_KEY = 'ada_test_history';

function readHistory(): TestCaseSet[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TestCaseSet[];
  } catch {
    return [];
  }
}

function writeHistory(history: TestCaseSet[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ─── Inlined: testCaseGenerator ──────────────────────────────────────────────
function getRepresentativeValue(param: Parameter): string | number | boolean {
  const t = param.paramType.toLowerCase();
  if (t.includes('integer') || t.includes('natural') || t.includes('positive')) return 5;
  if (t.includes('float') || t.includes('duration')) return 3.14;
  if (t.includes('boolean')) return true;
  if (t.includes('character')) return 'A';
  if (t.includes('string')) return 'hello';
  return 5;
}

function getEdgeValue(param: Parameter): string | number | boolean {
  const t = param.paramType.toLowerCase();
  if (t.includes('integer') || t.includes('natural') || t.includes('positive')) return 0;
  if (t.includes('float') || t.includes('duration')) return 0.0;
  if (t.includes('boolean')) return false;
  if (t.includes('character')) return ' ';
  if (t.includes('string')) return '';
  return 0;
}

function getInvalidValue(param: Parameter): string | number | boolean {
  const t = param.paramType.toLowerCase();
  if (t.includes('integer') || t.includes('natural') || t.includes('positive')) return -999999;
  if (t.includes('float')) return -1.0e38;
  if (t.includes('string')) return '!@#$%^&*()';
  return 'INVALID';
}

function computeExpected(
  subprogram: Subprogram,
  inputs: Record<string, string | number | boolean>,
  type: 'normal' | 'edge' | 'invalid'
): string | number | boolean {
  if (type === 'invalid') return 'Constraint_Error';
  const name = subprogram.name.toLowerCase();
  const vals = Object.values(inputs).filter((v) => typeof v === 'number') as number[];
  const a = vals[0] ?? 0;
  const b = vals[1] ?? 0;
  if (name.includes('add')) return a + b;
  if (name.includes('subtract')) return a - b;
  if (name.includes('multiply')) return a * b;
  if (name.includes('divide')) return b === 0 ? 'Division_Error' : parseFloat((a / b).toFixed(4));
  if (subprogram.kind === 'function') return a;
  return 'Success';
}

export function generateTestCases(subprogram: Subprogram): TestCase[] {
  const inParams = subprogram.parameters.filter((p) => p.mode === 'in' || p.mode === 'in out');
  const cases: TestCase[] = [];

  const normalInputs: Record<string, string | number | boolean> = {};
  for (const p of inParams) normalInputs[p.name] = getRepresentativeValue(p);
  cases.push({
    id: crypto.randomUUID(), inputs: normalInputs,
    expected: computeExpected(subprogram, normalInputs, 'normal'),
    type: 'normal', coverageHint: 'Covers typical execution path', runStatus: 'pending',
  });

  const edgeInputs: Record<string, string | number | boolean> = {};
  for (const p of inParams) edgeInputs[p.name] = getEdgeValue(p);
  cases.push({
    id: crypto.randomUUID(), inputs: edgeInputs,
    expected: computeExpected(subprogram, edgeInputs, 'edge'),
    type: 'edge', coverageHint: 'Warning: zero/null/empty boundary', runStatus: 'pending',
  });

  const invalidInputs: Record<string, string | number | boolean> = {};
  for (const p of inParams) invalidInputs[p.name] = getInvalidValue(p);
  cases.push({
    id: crypto.randomUUID(), inputs: invalidInputs,
    expected: 'Constraint_Error', type: 'invalid',
    coverageHint: '-- Invalid: values exceed expected range', runStatus: 'pending',
  });

  if (inParams.length >= 2) {
    const extra: Record<string, string | number | boolean> = {};
    const vals = [10, 20, 3, 7, 100, 42];
    inParams.forEach((p, idx) => {
      extra[p.name] = p.paramType.toLowerCase().includes('integer') ? vals[idx % vals.length] : getRepresentativeValue(p);
    });
    cases.push({
      id: crypto.randomUUID(), inputs: extra,
      expected: computeExpected(subprogram, extra, 'normal'),
      type: 'normal', coverageHint: 'Covers larger value range', runStatus: 'pending',
    });
  }

  if (inParams.some((p) => p.paramType.toLowerCase().includes('integer'))) {
    const maxInputs: Record<string, string | number | boolean> = {};
    for (const p of inParams) {
      maxInputs[p.name] = p.paramType.toLowerCase().includes('integer') ? 2147483647 : getRepresentativeValue(p);
    }
    cases.push({
      id: crypto.randomUUID(), inputs: maxInputs,
      expected: 'Overflow_Check', type: 'edge',
      coverageHint: 'Warning: Integer.Last boundary — potential overflow', runStatus: 'pending',
    });
  }

  return cases;
}

// ─── Inlined: exportUtils ────────────────────────────────────────────────────
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportAsJSON(sets: TestCaseSet[]): void {
  const filename = sets.length === 1
    ? `${sets[0].subprogramName}_tests_${Date.now()}.json`
    : `ada_tests_export_${Date.now()}.json`;
  downloadFile(JSON.stringify(sets, null, 2), filename, 'application/json');
}

function exportAllHistoryAsJSON(sets: TestCaseSet[]): void {
  downloadFile(JSON.stringify(sets, null, 2), `ada_test_history_${Date.now()}.json`, 'application/json');
}

function exportAsADB(set: TestCaseSet): void {
  const safeName = set.subprogramName.replace(/[^a-zA-Z0-9_]/g, '_');
  const testProcs = set.testCases.map((tc, idx) => {
    const inputLines = Object.entries(tc.inputs)
      .map(([k, v]) => `      ${k} : constant := ${JSON.stringify(v)};`).join('\n');
    return `   procedure Test_${safeName}_${idx + 1} is\n      -- Type: ${tc.type.toUpperCase()}\n${inputLines}\n      Expected : constant := ${JSON.stringify(tc.expected)};\n   begin\n      null;\n   end Test_${safeName}_${idx + 1};`;
  });
  const content = `-- Auto-generated Ada test stub\n-- Subprogram: ${set.subprogramName}\n-- Generated: ${new Date().toISOString()}\n\npackage body ${safeName}_Tests is\n\n${testProcs.join('\n\n')}\n\nend ${safeName}_Tests;\n`;
  downloadFile(content, `${safeName}_tests.adb`, 'text/plain');
}

// ─── Store ────────────────────────────────────────────────────────────────────
interface TestCaseStore {
  currentTestSets: Record<string, TestCase[]>;
  history: TestCaseSet[];
  generateTests: (subprogram: Subprogram) => void;
  setCurrentTests: (subprogramId: string, tests: TestCase[]) => void;
  saveToHistory: (set: TestCaseSet) => void;
  loadFromHistory: (setId: string) => void;
  deleteHistory: (setId: string) => void;
  updateTag: (setId: string, tag: string) => void;
  updateTestCase: (subprogramId: string, testId: string, updates: Partial<TestCase>) => void;
  exportCurrent: (subprogramId: string, subprogramName: string) => void;
  exportAllHistory: () => void;
  exportCurrentAsADB: (subprogramId: string, subprogramName: string) => void;
  setHistory: (history: TestCaseSet[]) => void;
  updateTestRunStatus: (subprogramId: string, testId: string, status: TestCase['runStatus'], actualOutput?: string) => void;
}

export const useTestCaseStore = create<TestCaseStore>((set, get) => ({
  currentTestSets: {},
  history: readHistory(),

  generateTests: (subprogram) => {
    const tests = generateTestCases(subprogram);
    set((state) => ({ currentTestSets: { ...state.currentTestSets, [subprogram.id]: tests } }));
  },

  setCurrentTests: (subprogramId, tests) =>
    set((state) => ({ currentTestSets: { ...state.currentTestSets, [subprogramId]: tests } })),

  saveToHistory: (testSet) => {
    set((state) => {
      const newHistory = [testSet, ...state.history].slice(0, 50);
      try {
        writeHistory(newHistory);
      } catch {
        const trimmed = newHistory.slice(0, newHistory.length - 5);
        writeHistory(trimmed);
        return { history: trimmed };
      }
      return { history: newHistory };
    });
  },

  loadFromHistory: (setId) => {
    const found = get().history.find((h) => h.id === setId);
    if (found) {
      set((state) => ({
        currentTestSets: { ...state.currentTestSets, [found.subprogramId]: found.testCases },
      }));
    }
  },

  deleteHistory: (setId) => {
    set((state) => {
      const newHistory = state.history.filter((h) => h.id !== setId);
      writeHistory(newHistory);
      return { history: newHistory };
    });
  },

  updateTag: (setId, tag) => {
    set((state) => {
      const newHistory = state.history.map((h) => h.id === setId ? { ...h, tag } : h);
      writeHistory(newHistory);
      return { history: newHistory };
    });
  },

  updateTestCase: (subprogramId, testId, updates) =>
    set((state) => ({
      currentTestSets: {
        ...state.currentTestSets,
        [subprogramId]: (state.currentTestSets[subprogramId] || []).map((tc) =>
          tc.id === testId ? { ...tc, ...updates } : tc
        ),
      },
    })),

  exportCurrent: (subprogramId, subprogramName) => {
    const tests = get().currentTestSets[subprogramId] || [];
    exportAsJSON([{ id: crypto.randomUUID(), subprogramId, subprogramName, timestamp: new Date().toISOString(), testCases: tests }]);
  },

  exportAllHistory: () => exportAllHistoryAsJSON(get().history),

  exportCurrentAsADB: (subprogramId, subprogramName) => {
    const tests = get().currentTestSets[subprogramId] || [];
    exportAsADB({ id: crypto.randomUUID(), subprogramId, subprogramName, timestamp: new Date().toISOString(), testCases: tests });
  },

  setHistory: (history) => set({ history }),

  updateTestRunStatus: (subprogramId, testId, status, actualOutput) =>
    set((state) => ({
      currentTestSets: {
        ...state.currentTestSets,
        [subprogramId]: (state.currentTestSets[subprogramId] || []).map((tc) =>
          tc.id === testId ? { ...tc, runStatus: status, actualOutput } : tc
        ),
      },
    })),
}));
