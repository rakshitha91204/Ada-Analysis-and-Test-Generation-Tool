export interface Diagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line: number;
  column: number;
}

export const mockDiagnostics: Diagnostic[] = [
  {
    id: 'diag_1',
    severity: 'warning',
    message: 'Unused variable "Temp" declared but never referenced',
    file: 'calculator.adb',
    line: 19,
    column: 7,
  },
  {
    id: 'diag_2',
    severity: 'warning',
    message: 'Unreachable code after unconditional raise statement',
    file: 'calculator.adb',
    line: 30,
    column: 10,
  },
  {
    id: 'diag_3',
    severity: 'error',
    message: 'Missing return statement in function "Divide" — not all paths return a value',
    file: 'calculator.adb',
    line: 34,
    column: 4,
  },
  {
    id: 'diag_4',
    severity: 'warning',
    message: 'Parameter "Result" in procedure "Add" shadows outer scope declaration',
    file: 'calculator.ads',
    line: 8,
    column: 38,
  },
];
