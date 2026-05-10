/**
 * PDF / HTML report export for Ada analysis results.
 * Generates a self-contained HTML report that can be printed to PDF.
 */
import { AdaFile } from '../types/file.types';
import { Subprogram } from '../types/subprogram.types';
import { TestCaseSet } from '../types/testcase.types';
import { Diagnostic } from '../types/diagnostic.types';

interface ReportData {
  files: AdaFile[];
  subprograms: Subprogram[];
  testSets: TestCaseSet[];
  diagnostics: Diagnostic[];
  generatedAt: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function complexityScore(sub: Subprogram): number {
  const lines = sub.endLine - sub.startLine + 1;
  if (lines <= 10) return 1;
  if (lines <= 25) return 2;
  if (lines <= 50) return 4;
  return 7;
}

function complexityLabel(score: number): string {
  if (score <= 2) return 'Low';
  if (score <= 4) return 'Medium';
  return 'High';
}

export function generateHTMLReport(data: ReportData): string {
  const { files, subprograms, testSets, diagnostics, generatedAt } = data;
  const allTests = testSets.flatMap((s) => s.testCases);
  const passed = allTests.filter((t) => t.runStatus === 'pass').length;
  const failed = allTests.filter((t) => t.runStatus === 'fail').length;
  const passRate = allTests.length > 0 ? Math.round((passed / allTests.length) * 100) : 0;
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;

  const subRows = subprograms.map((sub) => {
    const score = complexityScore(sub);
    const tests = testSets.find((s) => s.subprogramId === sub.id);
    const testCount = tests?.testCases.length ?? 0;
    const color = score <= 2 ? '#22c55e' : score <= 4 ? '#f59e0b' : '#ef4444';
    return `
      <tr>
        <td><code>${escapeHtml(sub.name)}</code></td>
        <td><span class="badge ${sub.kind}">${sub.kind}</span></td>
        <td>${sub.parameters.length}</td>
        <td>${sub.returnType ? escapeHtml(sub.returnType) : '—'}</td>
        <td>${sub.startLine}–${sub.endLine}</td>
        <td style="color:${color}">${score} (${complexityLabel(score)})</td>
        <td>${testCount}</td>
      </tr>`;
  }).join('');

  const diagRows = diagnostics.map((d) => {
    const color = d.severity === 'error' ? '#ef4444' : d.severity === 'warning' ? '#f59e0b' : '#60a5fa';
    return `
      <tr>
        <td style="color:${color}">${d.severity.toUpperCase()}</td>
        <td>${escapeHtml(d.message)}</td>
        <td><code>${escapeHtml(d.file)}:${d.line}:${d.column}</code></td>
      </tr>`;
  }).join('');

  const testRows = testSets.flatMap((set) =>
    set.testCases.map((tc) => {
      const statusColor = tc.runStatus === 'pass' ? '#22c55e' : tc.runStatus === 'fail' ? '#ef4444' : '#71717a';
      const inputs = Object.entries(tc.inputs).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      return `
        <tr>
          <td><code>${escapeHtml(set.subprogramName)}</code></td>
          <td><span class="badge ${tc.type}">${tc.type}</span></td>
          <td><code>${escapeHtml(inputs)}</code></td>
          <td><code>${escapeHtml(String(tc.expected))}</code></td>
          <td style="color:${statusColor}">${tc.runStatus ?? 'pending'}</td>
        </tr>`;
    })
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Ada Analysis Report — ${new Date(generatedAt).toLocaleDateString()}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0e0e10; color: #f4f4f5; padding: 32px; }
  h1 { font-size: 24px; color: #f59e0b; margin-bottom: 4px; }
  h2 { font-size: 16px; color: #a1a1aa; font-weight: 400; margin-bottom: 32px; }
  h3 { font-size: 14px; color: #f59e0b; margin: 32px 0 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .card { background: #16161a; border: 1px solid #27272a; border-radius: 10px; padding: 16px; text-align: center; }
  .card .val { font-size: 28px; font-weight: 700; font-family: monospace; }
  .card .lbl { font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
  .amber { color: #f59e0b; } .green { color: #22c55e; } .red { color: #ef4444; } .blue { color: #60a5fa; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
  th { background: #16161a; color: #a1a1aa; text-align: left; padding: 8px 12px; border-bottom: 1px solid #27272a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 8px 12px; border-bottom: 1px solid #1e1e24; vertical-align: top; }
  tr:hover td { background: #16161a; }
  code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #e4e4e7; background: #1e1e24; padding: 1px 4px; border-radius: 3px; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; font-family: monospace; }
  .badge.procedure { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .badge.function { background: rgba(251,146,60,0.15); color: #fb923c; }
  .badge.normal { background: rgba(34,197,94,0.15); color: #22c55e; }
  .badge.edge { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .badge.invalid { background: rgba(239,68,68,0.15); color: #ef4444; }
  .progress { height: 8px; background: #27272a; border-radius: 4px; overflow: hidden; margin-top: 8px; }
  .progress-bar { height: 100%; border-radius: 4px; }
  footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #27272a; font-size: 11px; color: #52525b; }
  @media print { body { background: white; color: black; } .card { border-color: #ccc; background: #f9f9f9; } }
</style>
</head>
<body>
<h1>◈ Ada Analysis Report</h1>
<h2>Generated ${new Date(generatedAt).toLocaleString()} · ${files.length} file(s) · ${subprograms.length} subprogram(s)</h2>

<div class="summary">
  <div class="card"><div class="val amber">${subprograms.length}</div><div class="lbl">Subprograms</div></div>
  <div class="card"><div class="val blue">${allTests.length}</div><div class="lbl">Test Cases</div></div>
  <div class="card"><div class="val green">${passed}</div><div class="lbl">Tests Passing</div></div>
  <div class="card"><div class="val red">${failed}</div><div class="lbl">Tests Failing</div></div>
  <div class="card"><div class="val ${passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'}">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  <div class="card"><div class="val red">${errors}</div><div class="lbl">Errors</div></div>
  <div class="card"><div class="val amber">${warnings}</div><div class="lbl">Warnings</div></div>
</div>

<div class="progress"><div class="progress-bar" style="width:${passRate}%;background:${passRate>=80?'#22c55e':passRate>=50?'#f59e0b':'#ef4444'}"></div></div>

<h3>Files Analyzed</h3>
<table>
  <tr><th>File</th><th>Type</th><th>Lines</th><th>Status</th></tr>
  ${files.map((f) => `<tr><td><code>${escapeHtml(f.name)}</code></td><td>${f.type}</td><td>${f.content.split('\n').length}</td><td>${f.status}</td></tr>`).join('')}
</table>

<h3>Subprograms</h3>
<table>
  <tr><th>Name</th><th>Kind</th><th>Params</th><th>Returns</th><th>Lines</th><th>Complexity</th><th>Tests</th></tr>
  ${subRows}
</table>

<h3>Diagnostics</h3>
${diagnostics.length === 0
  ? '<p style="color:#22c55e;font-size:13px">✓ No issues detected.</p>'
  : `<table><tr><th>Severity</th><th>Message</th><th>Location</th></tr>${diagRows}</table>`}

<h3>Test Cases</h3>
<table>
  <tr><th>Subprogram</th><th>Type</th><th>Inputs</th><th>Expected</th><th>Status</th></tr>
  ${testRows}
</table>

<footer>Ada Analysis &amp; Test Generation Tool · Frontend-only report · ${new Date(generatedAt).toISOString()}</footer>
</body>
</html>`;
}

export function downloadHTMLReport(data: ReportData) {
  const html = generateHTMLReport(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ada_report_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadProjectJSON(data: Omit<ReportData, 'diagnostics'> & { diagnostics?: Diagnostic[] }) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ada_project_${Date.now()}.adaproject.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
