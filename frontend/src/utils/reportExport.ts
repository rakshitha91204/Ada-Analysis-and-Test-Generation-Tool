/**
 * HTML/PDF report export for Ada Analysis & Test Generation Tool.
 * Generates a self-contained, print-ready HTML report.
 *
 * Two report types:
 *  1. generateHTMLReport   — full project report (files, subprograms, analysis, test sets)
 *  2. generateRunReport    — focused test-run report (actual runs with inputs/outputs/status)
 */
import { AdaFile } from '../types/file.types';
import { Subprogram } from '../types/subprogram.types';
import { TestCaseSet } from '../types/testcase.types';
import { Diagnostic } from '../types/diagnostic.types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReportData {
  files: AdaFile[];
  subprograms: Subprogram[];
  testSets: TestCaseSet[];
  diagnostics: Diagnostic[];
  generatedAt: string;
}

export interface TestRunRecord {
  subprogram: string;
  timestamp: string;
  savedAt?: string;
  status: 'pass' | 'fail' | 'error';
  message: string;
  explanation?: string;
  elapsed_ms: number;
  inputs: Record<string, string>;
  expected: Record<string, string>;
  actual: Record<string, string>;
  violations?: Array<{ variable: string; type: string; value: string; error: string }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s ?? '')
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

// Common CSS used by both report types
const COMMON_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0e0e10; color: #f4f4f5; padding: 32px; }
  @media print {
    body { background: white !important; color: #111 !important; padding: 20px; }
    .no-print { display: none !important; }
    .card { border-color: #ccc !important; background: #f9f9f9 !important; color: #111 !important; }
    .pass-row { background: #f0fdf4 !important; }
    .fail-row { background: #fef2f2 !important; }
    .error-row { background: #fffbeb !important; }
    h1,h2,h3 { color: #111 !important; }
    table { page-break-inside: avoid; }
    tr { page-break-inside: avoid; }
  }
  h1 { font-size: 22px; color: #f59e0b; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #a1a1aa; font-weight: 400; margin-bottom: 24px; }
  h3 { font-size: 13px; color: #f59e0b; margin: 28px 0 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #27272a; padding-bottom: 6px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 28px; }
  .card { background: #16161a; border: 1px solid #27272a; border-radius: 8px; padding: 14px; text-align: center; }
  .card .val { font-size: 26px; font-weight: 700; font-family: monospace; }
  .card .lbl { font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 3px; }
  .amber { color: #f59e0b; } .green { color: #22c55e; } .red { color: #ef4444; } .blue { color: #60a5fa; } .yellow { color: #fbbf24; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
  th { background: #16161a; color: #a1a1aa; text-align: left; padding: 7px 10px; border-bottom: 1px solid #27272a; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 7px 10px; border-bottom: 1px solid #1e1e24; vertical-align: top; word-break: break-word; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .pass-row td { border-left: 3px solid #22c55e; }
  .fail-row td { border-left: 3px solid #ef4444; }
  .error-row td { border-left: 3px solid #fbbf24; }
  code { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 11px; color: #e4e4e7; background: #1e1e24; padding: 1px 4px; border-radius: 3px; word-break: break-all; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; font-family: monospace; }
  .badge-pass { background: rgba(34,197,94,0.15); color: #22c55e; }
  .badge-fail { background: rgba(239,68,68,0.15); color: #ef4444; }
  .badge-error { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .badge-pending { background: rgba(113,113,122,0.15); color: #71717a; }
  .badge.procedure { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .badge.function { background: rgba(251,146,60,0.15); color: #fb923c; }
  .badge.normal { background: rgba(34,197,94,0.15); color: #22c55e; }
  .badge.edge { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .badge.invalid { background: rgba(239,68,68,0.15); color: #ef4444; }
  .kv { display: flex; gap: 8px; flex-wrap: wrap; }
  .kv-item { font-family: monospace; font-size: 11px; padding: 2px 6px; border-radius: 3px; background: #1e1e24; color: #e4e4e7; }
  .kv-item.expected { background: rgba(96,165,250,0.12); color: #93c5fd; }
  .kv-item.actual-ok { background: rgba(34,197,94,0.12); color: #86efac; }
  .kv-item.actual-bad { background: rgba(239,68,68,0.12); color: #fca5a5; }
  .explanation { font-size: 11px; color: #a1a1aa; margin-top: 4px; line-height: 1.5; }
  .progress { height: 6px; background: #27272a; border-radius: 3px; overflow: hidden; margin: 8px 0 20px; }
  .progress-bar { height: 100%; border-radius: 3px; }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #27272a; font-size: 10px; color: #52525b; display: flex; justify-content: space-between; }
  .print-btn { position: fixed; top: 16px; right: 16px; padding: 8px 16px; background: #f59e0b; color: #000; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; z-index: 999; }
`;

// ── 1. Full Project Report ─────────────────────────────────────────────────────

export function generateHTMLReport(data: ReportData): string {
  const { files, subprograms, testSets, diagnostics, generatedAt } = data;
  const allTests = testSets.flatMap((s) => s.testCases);
  const passed   = allTests.filter((t) => t.runStatus === 'pass').length;
  const failed   = allTests.filter((t) => t.runStatus === 'fail').length;
  const passRate = allTests.length > 0 ? Math.round((passed / allTests.length) * 100) : 0;
  const errors   = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;

  const subRows = subprograms.map((sub) => {
    const score    = complexityScore(sub);
    const tests    = testSets.find((s) => s.subprogramId === sub.id);
    const testCount = tests?.testCases.length ?? 0;
    const color    = score <= 2 ? '#22c55e' : score <= 4 ? '#f59e0b' : '#ef4444';
    const paramSig = sub.parameters.map(p => `${p.name} : ${p.mode} ${p.paramType}`).join('; ');
    return `<tr>
      <td><code>${escapeHtml(sub.name)}</code>${sub.returnType ? `<br><span style="font-size:10px;color:#fb923c">→ ${escapeHtml(sub.returnType)}</span>` : ''}</td>
      <td><span class="badge ${sub.kind}">${sub.kind}</span></td>
      <td style="font-size:10px;color:#a1a1aa"><code>${escapeHtml(paramSig) || '—'}</code></td>
      <td style="font-size:10px">${sub.startLine}–${sub.endLine}</td>
      <td style="color:${color}">${score} (${complexityLabel(score)})</td>
      <td>${testCount}</td>
    </tr>`;
  }).join('');

  const diagRows = diagnostics.map((d) => {
    const color = d.severity === 'error' ? '#ef4444' : d.severity === 'warning' ? '#f59e0b' : '#60a5fa';
    return `<tr>
      <td style="color:${color};font-weight:600">${d.severity.toUpperCase()}</td>
      <td>${escapeHtml(d.message)}</td>
      <td><code>${escapeHtml(d.file)}:${d.line}</code></td>
    </tr>`;
  }).join('');

  const testRows = testSets.flatMap((set) =>
    set.testCases.map((tc) => {
      const sc = tc.runStatus === 'pass' ? 'pass' : tc.runStatus === 'fail' ? 'fail' : 'pending';
      const inputs = Object.entries(tc.inputs).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      return `<tr>
        <td><code>${escapeHtml(set.subprogramName)}</code></td>
        <td><span class="badge ${tc.type}">${tc.type}</span></td>
        <td><code>${escapeHtml(inputs)}</code></td>
        <td><code>${escapeHtml(String(tc.expected))}</code></td>
        <td><span class="badge badge-${sc}">${tc.runStatus ?? 'pending'}</span></td>
      </tr>`;
    })
  ).join('');

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Ada Analysis Report — ${new Date(generatedAt).toLocaleDateString()}</title>
<style>${COMMON_CSS}</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>
<h1>◈ Ada Analysis &amp; Test Report</h1>
<h2>Generated ${new Date(generatedAt).toLocaleString()} &nbsp;·&nbsp; ${files.length} file(s) &nbsp;·&nbsp; ${subprograms.length} subprogram(s)</h2>

<div class="summary">
  <div class="card"><div class="val amber">${subprograms.length}</div><div class="lbl">Subprograms</div></div>
  <div class="card"><div class="val blue">${allTests.length}</div><div class="lbl">Test Cases</div></div>
  <div class="card"><div class="val green">${passed}</div><div class="lbl">Passing</div></div>
  <div class="card"><div class="val red">${failed}</div><div class="lbl">Failing</div></div>
  <div class="card"><div class="val ${passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'}">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  <div class="card"><div class="val red">${errors}</div><div class="lbl">Errors</div></div>
  <div class="card"><div class="val amber">${warnings}</div><div class="lbl">Warnings</div></div>
</div>
<div class="progress"><div class="progress-bar" style="width:${passRate}%;background:${passRate>=80?'#22c55e':passRate>=50?'#f59e0b':'#ef4444'}"></div></div>

<h3>Files Analyzed</h3>
<table>
  <tr><th>File</th><th>Type</th><th>Lines</th><th>Status</th></tr>
  ${files.map(f => `<tr><td><code>${escapeHtml(f.name)}</code></td><td>${f.type}</td><td>${f.content.split('\n').length}</td><td>${f.status}</td></tr>`).join('')}
</table>

<h3>Subprograms (${subprograms.length})</h3>
<table>
  <tr><th>Name</th><th>Kind</th><th>Parameters</th><th>Lines</th><th>Complexity</th><th>Tests</th></tr>
  ${subRows || '<tr><td colspan="6" style="color:#52525b">No subprograms found — analyse a .adb file first</td></tr>'}
</table>

<h3>Diagnostics</h3>
${diagnostics.length === 0
  ? '<p style="color:#22c55e;font-size:12px;margin-bottom:20px">✓ No issues detected.</p>'
  : `<table><tr><th>Severity</th><th>Message</th><th>Location</th></tr>${diagRows}</table>`}

<h3>Test Cases (${allTests.length})</h3>
<table>
  <tr><th>Subprogram</th><th>Type</th><th>Inputs</th><th>Expected</th><th>Status</th></tr>
  ${testRows || '<tr><td colspan="5" style="color:#52525b">No test cases generated yet</td></tr>'}
</table>

<footer>
  <span>Ada Analysis &amp; Test Generation Tool</span>
  <span>${new Date(generatedAt).toISOString()}</span>
</footer>
</body></html>`;
}

// ── 2. Test Run Report ─────────────────────────────────────────────────────────

/**
 * Generates a focused report of actual test RUNS (from localStorage run history).
 * This is the "after running, download PDF" report.
 */
export function generateRunReport(
  runs: Array<{ subprogram: string; runs: TestRunRecord[] }>,
  generatedAt: string,
  projectName?: string
): string {
  const allRuns = runs.flatMap(g => g.runs);
  const totalRuns  = allRuns.length;
  const passCount  = allRuns.filter(r => r.status === 'pass').length;
  const failCount  = allRuns.filter(r => r.status === 'fail').length;
  const errorCount = allRuns.filter(r => r.status === 'error').length;
  const passRate   = totalRuns > 0 ? Math.round((passCount / totalRuns) * 100) : 0;

  const groupRows = runs.map(group => {
    if (group.runs.length === 0) return '';
    const gPass  = group.runs.filter(r => r.status === 'pass').length;
    const gFail  = group.runs.filter(r => r.status === 'fail').length;
    const gError = group.runs.filter(r => r.status === 'error').length;

    const runRows = group.runs.map((r, idx) => {
      const rowClass = r.status === 'pass' ? 'pass-row' : r.status === 'fail' ? 'fail-row' : 'error-row';
      const statusBadge = `<span class="badge badge-${r.status}">${r.status.toUpperCase()}</span>`;

      // Format inputs
      const inputItems = Object.entries(r.inputs || {}).map(([k, v]) =>
        `<span class="kv-item">${escapeHtml(k)} = <b>${escapeHtml(v)}</b></span>`
      ).join(' ');

      // Format expected
      const expectedItems = Object.entries(r.expected || {}).map(([k, v]) =>
        `<span class="kv-item expected">${escapeHtml(k)} → <b>${escapeHtml(v)}</b></span>`
      ).join(' ');

      // Format actual output
      const actualItems = Object.entries(r.actual || {}).map(([k, v]) => {
        const ok = r.expected[k] === v;
        return `<span class="kv-item ${ok ? 'actual-ok' : 'actual-bad'}">${escapeHtml(k)} = <b>${escapeHtml(v)}</b>${ok ? ' ✓' : ' ✗'}</span>`;
      }).join(' ');

      // Format violations
      const violationHtml = (r.violations || []).length > 0
        ? `<div style="margin-top:4px;color:#fbbf24;font-size:10px">${r.violations!.map(v => `${escapeHtml(v.variable)}: ${escapeHtml(v.error)}`).join(' · ')}</div>`
        : '';

      // Format date
      const dateStr = (() => {
        try {
          const d = new Date(r.savedAt ?? r.timestamp);
          if (isNaN(d.getTime())) return r.timestamp;
          return d.toLocaleString();
        } catch { return r.timestamp; }
      })();

      return `<tr class="${rowClass}">
        <td style="color:#71717a;font-size:10px;white-space:nowrap">${escapeHtml(dateStr)}</td>
        <td>${statusBadge}</td>
        <td><div class="kv">${inputItems || '<span style="color:#52525b;font-size:10px">—</span>'}</div></td>
        <td><div class="kv">${expectedItems || '<span style="color:#52525b;font-size:10px">—</span>'}</div></td>
        <td><div class="kv">${actualItems || '<span style="color:#52525b;font-size:10px">—</span>'}</div></td>
        <td style="font-size:10px;color:#71717a">${r.elapsed_ms ?? 0}ms</td>
        <td><div class="explanation">${escapeHtml(r.message || '')}${r.explanation ? `<br>${escapeHtml(r.explanation)}` : ''}${violationHtml}</div></td>
      </tr>`;
    }).join('');

    return `
      <div style="margin-bottom:4px">
        <span style="font-size:13px;font-weight:700;color:#facc15;font-family:monospace">${escapeHtml(group.subprogram)}</span>
        <span style="font-size:10px;color:#71717a;margin-left:8px">${group.runs.length} run${group.runs.length !== 1 ? 's' : ''}</span>
        <span style="margin-left:8px"><span class="badge badge-pass">${gPass} pass</span></span>
        ${gFail > 0 ? `<span style="margin-left:4px"><span class="badge badge-fail">${gFail} fail</span></span>` : ''}
        ${gError > 0 ? `<span style="margin-left:4px"><span class="badge badge-error">${gError} error</span></span>` : ''}
      </div>
      <table style="margin-bottom:24px">
        <tr><th>Time</th><th>Status</th><th>Inputs</th><th>Expected</th><th>Actual</th><th>ms</th><th>Message</th></tr>
        ${runRows}
      </table>`;
  }).join('');

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Test Run Report — ${new Date(generatedAt).toLocaleDateString()}</title>
<style>${COMMON_CSS}</style>
</head><body>
<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>
<h1>◈ Test Run Report</h1>
<h2>${projectName ? `Project: ${escapeHtml(projectName)} &nbsp;·&nbsp; ` : ''}Generated ${new Date(generatedAt).toLocaleString()}</h2>

<div class="summary">
  <div class="card"><div class="val blue">${totalRuns}</div><div class="lbl">Total Runs</div></div>
  <div class="card"><div class="val green">${passCount}</div><div class="lbl">Passed</div></div>
  <div class="card"><div class="val red">${failCount}</div><div class="lbl">Failed</div></div>
  <div class="card"><div class="val yellow">${errorCount}</div><div class="lbl">Errors</div></div>
  <div class="card"><div class="val ${passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'}">${passRate}%</div><div class="lbl">Pass Rate</div></div>
  <div class="card"><div class="val amber">${runs.length}</div><div class="lbl">Subprograms</div></div>
</div>
<div class="progress"><div class="progress-bar" style="width:${passRate}%;background:${passRate>=80?'#22c55e':passRate>=50?'#f59e0b':'#ef4444'}"></div></div>

<h3>Test Runs by Subprogram</h3>
${groupRows || '<p style="color:#52525b;font-size:12px">No test runs recorded yet — run tests in the Test Cases tab first.</p>'}

<footer>
  <span>Ada Analysis &amp; Test Generation Tool — Test Run Report</span>
  <span>${new Date(generatedAt).toISOString()}</span>
</footer>
</body></html>`;
}

// ── Download helpers ───────────────────────────────────────────────────────────

export function downloadHTMLReport(data: ReportData) {
  const html = generateHTMLReport(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ada_report_${Date.now()}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function downloadRunReport(
  runs: Array<{ subprogram: string; runs: TestRunRecord[] }>,
  projectName?: string
) {
  const html = generateRunReport(runs, new Date().toISOString(), projectName);
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ada_test_runs_${Date.now()}.html`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function downloadProjectJSON(data: Omit<ReportData, 'diagnostics'> & {
  diagnostics?: Diagnostic[];
  runHistory?: Array<{ subprogram: string; runs: unknown[] }>;
}) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ada_project_${Date.now()}.adaproject.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
