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
