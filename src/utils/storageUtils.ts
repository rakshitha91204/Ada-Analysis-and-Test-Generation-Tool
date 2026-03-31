import { TestCaseSet } from '../types/testcase.types';

const HISTORY_KEY = 'ada_test_history';

export function readHistory(): TestCaseSet[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TestCaseSet[];
  } catch {
    return [];
  }
}

export function writeHistory(history: TestCaseSet[]): void {
  const data = JSON.stringify(history);
  localStorage.setItem(HISTORY_KEY, data);
}

export function deleteHistoryItem(id: string): void {
  const history = readHistory();
  writeHistory(history.filter((h) => h.id !== id));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
