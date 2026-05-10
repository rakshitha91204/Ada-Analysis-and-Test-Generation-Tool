// Re-export Diagnostic type from the canonical types file
export type { Diagnostic } from '../types/diagnostic.types';

export const mockDiagnostics = [
  {
    id: 'diag_1',
    severity: 'warning' as const,
    message: 'Unused variable "Temp" declared but never referenced',
    file: 'calculator.adb',
    line: 19,
    column: 7,
  },
  {
    id: 'diag_2',
    severity: 'warning' as const,
    message: 'Unreachable code after unconditional raise statement',
    file: 'calculator.adb',
    line: 30,
    column: 10,
  },
  {
    id: 'diag_3',
    severity: 'error' as const,
    message: 'Missing return statement in function "Divide" — not all paths return a value',
    file: 'calculator.adb',
    line: 34,
    column: 4,
  },
  {
    id: 'diag_4',
    severity: 'warning' as const,
    message: 'Parameter "Result" in procedure "Add" shadows outer scope declaration',
    file: 'calculator.ads',
    line: 8,
    column: 38,
  },
];
