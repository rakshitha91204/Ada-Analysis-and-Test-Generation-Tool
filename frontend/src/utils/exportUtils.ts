import { TestCaseSet } from '../types/testcase.types';

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsJSON(sets: TestCaseSet[]): void {
  const content = JSON.stringify(sets, null, 2);
  const filename = sets.length === 1
    ? `${sets[0].subprogramName}_tests_${Date.now()}.json`
    : `ada_tests_export_${Date.now()}.json`;
  downloadFile(content, filename, 'application/json');
}

export function exportAllHistoryAsJSON(sets: TestCaseSet[]): void {
  const content = JSON.stringify(sets, null, 2);
  downloadFile(content, `ada_test_history_${Date.now()}.json`, 'application/json');
}

export function exportAsADB(set: TestCaseSet): void {
  const procName = set.subprogramName;
  const safeName = procName.replace(/[^a-zA-Z0-9_]/g, '_');

  const testProcs = set.testCases.map((tc, idx) => {
    const inputLines = Object.entries(tc.inputs)
      .map(([k, v]) => `      ${k} : constant := ${JSON.stringify(v)};`)
      .join('\n');

    return `   procedure Test_${safeName}_${idx + 1} is
      -- Type: ${tc.type.toUpperCase()}
      -- Coverage: ${tc.coverageHint ?? 'N/A'}
${inputLines}
      Expected : constant := ${JSON.stringify(tc.expected)};
   begin
      -- Call: ${procName}(${Object.keys(tc.inputs).join(', ')})
      -- Assert result = Expected
      null;
   end Test_${safeName}_${idx + 1};`;
  });

  const content = `-- Auto-generated Ada test stub
-- Subprogram: ${procName}
-- Generated: ${new Date().toISOString()}
-- Tag: ${set.tag ?? 'untagged'}

with Ada.Text_IO; use Ada.Text_IO;

package body ${safeName}_Tests is

${testProcs.join('\n\n')}

   procedure Run_All_Tests is
   begin
${set.testCases.map((_, idx) => `      Test_${safeName}_${idx + 1};`).join('\n')}
      Put_Line ("All tests completed for ${procName}");
   end Run_All_Tests;

end ${safeName}_Tests;
`;

  downloadFile(content, `${safeName}_tests.adb`, 'text/plain');
}
