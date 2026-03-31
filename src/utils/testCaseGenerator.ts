import { Subprogram, Parameter } from '../types/subprogram.types';
import { TestCase, TestCaseType } from '../types/testcase.types';

function getRepresentativeValue(param: Parameter): string | number | boolean {
  const t = param.paramType.toLowerCase();
  if (t.includes('integer') || t.includes('natural') || t.includes('positive')) return 5;
  if (t.includes('float') || t.includes('long_float') || t.includes('duration')) return 3.14;
  if (t.includes('boolean')) return true;
  if (t.includes('character')) return 'A';
  if (t.includes('string')) return 'hello';
  return 5;
}

function getEdgeValue(param: Parameter): string | number | boolean {
  const t = param.paramType.toLowerCase();
  if (t.includes('integer') || t.includes('natural') || t.includes('positive')) return 0;
  if (t.includes('float') || t.includes('long_float') || t.includes('duration')) return 0.0;
  if (t.includes('boolean')) return false;
  if (t.includes('character')) return ' ';
  if (t.includes('string')) return '';
  return 0;
}

function getInvalidValue(param: Parameter): string | number | boolean {
  const t = param.paramType.toLowerCase();
  if (t.includes('integer') || t.includes('natural') || t.includes('positive')) return -999999;
  if (t.includes('float')) return -1.0e38;
  if (t.includes('boolean')) return 'not_a_boolean' as unknown as boolean;
  if (t.includes('string')) return '!@#$%^&*()';
  return 'INVALID';
}

function computeExpected(
  subprogram: Subprogram,
  inputs: Record<string, string | number | boolean>,
  type: TestCaseType
): string | number | boolean {
  const name = subprogram.name.toLowerCase();

  if (type === 'invalid') return 'Constraint_Error';

  const vals = Object.values(inputs).filter((v) => typeof v === 'number') as number[];
  const a = vals[0] ?? 0;
  const b = vals[1] ?? 0;

  if (name.includes('add')) return a + b;
  if (name.includes('subtract')) return a - b;
  if (name.includes('multiply')) return a * b;
  if (name.includes('divide')) {
    if (b === 0) return 'Division_Error';
    return parseFloat((a / b).toFixed(4));
  }
  if (name.includes('max')) return Math.max(a, b);
  if (name.includes('min')) return Math.min(a, b);
  if (name.includes('factorial')) return a <= 1 ? 1 : 'N!';
  if (name.includes('power')) return Math.pow(a, b);

  if (subprogram.kind === 'function') return a;
  return 'Success';
}

export function generateTestCases(subprogram: Subprogram): TestCase[] {
  const inParams = subprogram.parameters.filter((p) => p.mode === 'in' || p.mode === 'in out');
  const cases: TestCase[] = [];

  // Normal test
  const normalInputs: Record<string, string | number | boolean> = {};
  for (const p of inParams) normalInputs[p.name] = getRepresentativeValue(p);
  cases.push({
    id: crypto.randomUUID(),
    inputs: normalInputs,
    expected: computeExpected(subprogram, normalInputs, 'normal'),
    type: 'normal',
    coverageHint: 'Covers typical execution path',
    runStatus: 'pending',
  });

  // Edge test
  const edgeInputs: Record<string, string | number | boolean> = {};
  for (const p of inParams) edgeInputs[p.name] = getEdgeValue(p);
  const edgeExpected = computeExpected(subprogram, edgeInputs, 'edge');
  cases.push({
    id: crypto.randomUUID(),
    inputs: edgeInputs,
    expected: edgeExpected,
    type: 'edge',
    coverageHint: 'Warning: zero/null/empty boundary — check for division by zero or empty input handling',
    runStatus: 'pending',
  });

  // Invalid test
  const invalidInputs: Record<string, string | number | boolean> = {};
  for (const p of inParams) invalidInputs[p.name] = getInvalidValue(p);
  cases.push({
    id: crypto.randomUUID(),
    inputs: invalidInputs,
    expected: 'Constraint_Error',
    type: 'invalid',
    coverageHint: '-- Invalid type hint: values exceed expected range, expect Constraint_Error',
    runStatus: 'pending',
  });

  // Extra normal test with different values
  if (inParams.length >= 2) {
    const extra1: Record<string, string | number | boolean> = {};
    const vals = [10, 20, 3, 7, 100, 42];
    inParams.forEach((p, idx) => {
      const t = p.paramType.toLowerCase();
      if (t.includes('integer') || t.includes('natural') || t.includes('positive')) {
        extra1[p.name] = vals[idx % vals.length];
      } else {
        extra1[p.name] = getRepresentativeValue(p);
      }
    });
    cases.push({
      id: crypto.randomUUID(),
      inputs: extra1,
      expected: computeExpected(subprogram, extra1, 'normal'),
      type: 'normal',
      coverageHint: 'Covers larger value range',
      runStatus: 'pending',
    });
  }

  // Extra edge test: max integer hint
  if (inParams.some((p) => p.paramType.toLowerCase().includes('integer'))) {
    const maxInputs: Record<string, string | number | boolean> = {};
    for (const p of inParams) {
      const t = p.paramType.toLowerCase();
      maxInputs[p.name] = t.includes('integer') ? 2147483647 : getRepresentativeValue(p);
    }
    cases.push({
      id: crypto.randomUUID(),
      inputs: maxInputs,
      expected: 'Overflow_Check',
      type: 'edge',
      coverageHint: 'Warning: Integer.Last boundary — potential overflow',
      runStatus: 'pending',
    });
  }

  return cases;
}
