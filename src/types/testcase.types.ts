export type TestCaseType = 'normal' | 'edge' | 'invalid';

export interface TestCase {
  id: string;
  inputs: Record<string, string | number | boolean>;
  expected: string | number | boolean;
  type: TestCaseType;
  coverageHint?: string;
  runStatus?: 'pending' | 'running' | 'pass' | 'fail';
  actualOutput?: string;
}

export interface TestCaseSet {
  id: string;
  subprogramId: string;
  subprogramName: string;
  timestamp: string;
  tag?: string;
  testCases: TestCase[];
}

// ── TestRunRecord: a single actual test execution stored in run history ────────
export interface TestRunRecord {
  id?: string;
  subprogram: string;
  timestamp: string;
  savedAt?: string;          // ISO date for TTL expiry
  status: 'pass' | 'fail' | 'error';
  message: string;
  explanation?: string;
  elapsed_ms: number;
  inputs: Record<string, string>;
  expected: Record<string, string>;
  actual: Record<string, string>;
  violations?: Array<{ variable: string; type: string; value: string; error: string }>;
}
