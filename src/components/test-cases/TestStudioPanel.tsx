/**
 * TestStudioPanel.tsx
 * ===================
 * Ada Test Studio embedded inside the main IDE bottom panel.
 * Author: Rakshitha
 *
 * All 5 bug fixes from correction/ada_test_studio:
 *   BUG FIX 1: safeFetch() guards against HTML error pages returned as JSON
 *   BUG FIX 2: activeTab state drives tab visibility
 *   BUG FIX 3: inputs reset on subprogram switch
 *   BUG FIX 4: exact dir comparison ("in"/"out"/"in out")
 *   BUG FIX 5: useRef for path input
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/TestStudio.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdaFile { path: string; name: string; ext: string; size: number; }

interface TypeConstraint {
  kind: 'integer' | 'float' | 'boolean' | 'character' | 'string' | 'unknown';
  min?: number; max?: number; values?: string[];
}

interface SubpParam {
  name: string; dir: 'in' | 'out' | 'in out';
  type: string; type_normalized: string; constraint: TypeConstraint;
}

interface SubpVariable {
  name: string; type: string; type_normalized: string;
  scope: 'local' | 'global' | 'constant'; constraint: TypeConstraint;
}

interface Subprogram {
  name: string; file: string; file_name: string;
  start_line: number | null; end_line: number | null;
  return_type: string | null;
  params: SubpParam[]; variables: SubpVariable[];
  complexity: number | null; is_dead: boolean; calls: string[];
}

interface TestResult {
  id: string; subprogram: string; timestamp: string;
  status: 'pass' | 'fail' | 'error';
  message: string; actual: Record<string, string>;
  elapsed_ms: number;
  violations?: Array<{ variable: string; type: string; value: string; error: string }>;
  normalized_types?: Record<string, string>;
  inputs: Record<string, string>; expected: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeDefault(type: string): string {
  const tl = (type || '').toLowerCase();
  if (tl.includes('bool'))      return 'False';
  if (tl.includes('float'))     return '0.0';
  if (tl.includes('character')) return "'A'";
  if (tl.includes('string'))    return '"Hello"';
  return '0';
}

function typeLabel(type: string): string {
  const tl = (type || '').toLowerCase();
  if (tl.includes('uint16'))  return '0 .. 65535';
  if (tl.includes('uint32'))  return '0 .. 4294967295';
  if (tl.includes('uint8'))   return '0 .. 255';
  if (tl.includes('positive')) return '1 .. 2147483647';
  if (tl.includes('natural')) return '0 .. 2147483647';
  if (tl.includes('integer')) return '-2147483648 .. 2147483647';
  if (tl.includes('float'))   return 'float';
  if (tl.includes('bool'))    return 'True | False';
  return '';
}

function CaseBadge({ type }: { type: string }) {
  const t = type || '', tl = t.toLowerCase();
  if (t === t.toUpperCase() && t !== tl)
    return <span className="ts-badge ts-badge-caps">CAPS</span>;
  if (t === tl)
    return <span className="ts-badge ts-badge-lower">lower</span>;
  return <span className="ts-badge ts-badge-orig">orig</span>;
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: '#1D9E75', fail: '#E24B4A', error: '#BA7517', none: '#B4B2A9',
  };
  return <span className="ts-status-dot" style={{ background: colors[status] || colors.none }} />;
}

// ── API (BUG FIX 1) ───────────────────────────────────────────────────────────

const API = '/api';

async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const r = await fetch(url, options);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await r.text();
    throw new Error(`Expected JSON from ${url} but got ${r.status}. Body: ${text.slice(0, 120)}`);
  }
  return r;
}

async function apiGet<T>(path: string): Promise<T> {
  try {
    const r = await safeFetch(API + path);
    if (!r.ok) { console.error(`[TestStudio] GET ${path} → ${r.status}`); return [] as unknown as T; }
    return r.json();
  } catch (e) {
    console.error(`[TestStudio] GET ${path} failed:`, (e as Error).message);
    return [] as unknown as T;
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  try {
    const r = await safeFetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) console.error(`[TestStudio] POST ${path} → ${r.status}`, data);
    return data;
  } catch (e) {
    console.error(`[TestStudio] POST ${path} failed:`, (e as Error).message);
    return { error: (e as Error).message } as unknown as T;
  }
}

// ── SubprogramList ────────────────────────────────────────────────────────────

function SubprogramList({ subprograms, activeSubp, testResults, onSelect }: {
  subprograms: Subprogram[]; activeSubp: Subprogram | null;
  testResults: TestResult[]; onSelect: (s: Subprogram) => void;
}) {
  const statusOf = (name: string) => {
    const rs = testResults.filter(r => r.subprogram === name);
    if (!rs.length) return 'none';
    if (rs.some(r => r.status === 'fail' || r.status === 'error')) return 'fail';
    if (rs.every(r => r.status === 'pass')) return 'pass';
    return 'none';
  };
  return (
    <div className="ts-panel" style={{ minWidth: 160, maxWidth: 180, borderRight: '0.5px solid rgba(0,0,0,0.12)', height: '100%', overflowY: 'auto' }}>
      <div className="ts-panel-head">ƒ subprograms
        {subprograms.length === 0 && <span style={{ fontSize: 10, color: '#888780', marginLeft: 4 }}>— analyze first</span>}
      </div>
      {subprograms.map(s => (
        <div key={`${s.file}-${s.name}`}
          className={`ts-sidebar-item ${activeSubp?.name === s.name && activeSubp?.file === s.file ? 'active' : ''}`}
          onClick={() => onSelect(s)}>
          <StatusDot status={statusOf(s.name)} />
          <span className="ts-item-name">{s.name}</span>
          {s.is_dead && <span className="ts-badge ts-badge-dead">dead</span>}
        </div>
      ))}
    </div>
  );
}

// ── TestPanel ─────────────────────────────────────────────────────────────────

function TestPanel({ subp, testResults, onRunTest }: {
  subp: Subprogram | null;
  testResults: TestResult[];
  onRunTest: (name: string, inputs: Record<string, string>, expected: Record<string, string>) => Promise<TestResult>;
}) {
  const [inputs,     setInputs]     = useState<Record<string, string>>({});
  const [expected,   setExpected]   = useState<Record<string, string>>({});
  const [running,    setRunning]    = useState(false);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  // BUG FIX 2: activeTab state drives visibility
  const [activeTab, setActiveTab]   = useState<'inputs' | 'variables' | 'history'>('inputs');

  // BUG FIX 3: reset inputs when subprogram changes
  useEffect(() => {
    if (!subp) return;
    const init: Record<string, string> = {};
    subp.params.filter(p => p.dir === 'in' || p.dir === 'in out')
      .forEach(p => { init[p.name] = typeDefault(p.type); });
    setInputs(init);
    const exp: Record<string, string> = {};
    subp.params.filter(p => p.dir === 'out' || p.dir === 'in out')
      .forEach(p => { exp[p.name] = typeDefault(p.type); });
    setExpected(exp);
    setLastResult(null);
    setActiveTab('inputs');
  }, [subp?.name, subp?.file]);

  const setInput  = (k: string, v: string) => setInputs(i  => ({ ...i, [k]: v }));
  const setExpect = (k: string, v: string) => setExpected(e => ({ ...e, [k]: v }));

  const autoGen = () => {
    if (!subp) return;
    const next: Record<string, string> = {};
    subp.params.filter(p => p.dir === 'in' || p.dir === 'in out').forEach(p => {
      const c = p.constraint;
      if (c.kind === 'integer') next[p.name] = String(Math.floor(Math.random() * Math.min((c.max ?? 255), 255)));
      else if (c.kind === 'float') next[p.name] = (Math.random() * 10).toFixed(2);
      else if (c.kind === 'boolean') next[p.name] = Math.random() > 0.5 ? 'True' : 'False';
      else next[p.name] = typeDefault(p.type);
    });
    setInputs(next);
  };

  const runTest = async () => {
    if (!subp) return;
    setRunning(true);
    const result = await onRunTest(subp.name, inputs, expected);
    setLastResult(result);
    setRunning(false);
  };

  if (!subp) return (
    <div className="ts-empty-state" style={{ flex: 1 }}>
      ƒ select a subprogram to test
    </div>
  );

  // BUG FIX 4: exact direction comparison
  const inParams    = subp.params.filter(p => p.dir === 'in' || p.dir === 'in out');
  const outParams   = subp.params.filter(p => p.dir === 'out' || p.dir === 'in out');
  const prevResults = testResults.filter(r => r.subprogram === subp.name);

  return (
    <div className="ts-test-panel" style={{ flex: 1, overflow: 'auto' }}>
      {/* Header */}
      <div className="ts-test-head">
        <span className="ts-test-title">{subp.name}</span>
        <div className="ts-test-meta">
          <span>{subp.file_name}</span>
          {subp.start_line && <span>· lines {subp.start_line}–{subp.end_line}</span>}
          {subp.complexity  && <span>· complexity {subp.complexity}</span>}
          {subp.is_dead && <span className="ts-badge ts-badge-dead">dead code</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="ts-section-tabs">
        {(['inputs', 'variables', 'history'] as const).map(tab => (
          <span key={tab}
            className={`ts-stab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab}
            {tab === 'history' && prevResults.length > 0 &&
              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({prevResults.length})</span>}
          </span>
        ))}
      </div>

      {/* INPUTS TAB */}
      {activeTab === 'inputs' && (
        <div className="ts-input-section">
          {inParams.length === 0
            ? <div className="ts-empty-state" style={{ padding: '1rem 0' }}>no in parameters</div>
            : <>
                <div className="ts-section-label">in parameters — set test values</div>
                <div className="ts-input-grid">
                  {inParams.map(p => (
                    <div key={p.name} className="ts-input-card">
                      <div className="ts-input-header">
                        <span className="ts-input-dir">{p.dir}</span>
                        <span className="ts-input-name">{p.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">
                        {p.type} <CaseBadge type={p.type} />
                      </div>
                      {typeLabel(p.type) && <div className="ts-input-range">{typeLabel(p.type)}</div>}
                      {p.constraint.kind === 'boolean'
                        ? <select className="ts-input-field"
                            value={inputs[p.name] ?? 'False'}
                            onChange={e => setInput(p.name, e.target.value)}>
                            <option>False</option><option>True</option>
                          </select>
                        : <input className="ts-input-field"
                            type={p.constraint.kind === 'integer' ? 'number' : 'text'}
                            value={inputs[p.name] ?? typeDefault(p.type)}
                            onChange={e => setInput(p.name, e.target.value)}
                            min={p.constraint.min} max={p.constraint.max} />}
                    </div>
                  ))}
                </div>
              </>}

          {outParams.length > 0 && <>
            <div className="ts-section-label">expected output values</div>
            <div className="ts-input-grid">
              {outParams.map(p => (
                <div key={p.name} className="ts-input-card ts-input-card-out">
                  <div className="ts-input-header">
                    <span className="ts-input-dir out">out</span>
                    <span className="ts-input-name">{p.name}</span>
                  </div>
                  <div className="ts-input-type ts-mono">{p.type} <CaseBadge type={p.type} /></div>
                  {typeLabel(p.type) && <div className="ts-input-range">{typeLabel(p.type)}</div>}
                  <input className="ts-input-field" type="text"
                    value={expected[p.name] ?? typeDefault(p.type)}
                    onChange={e => setExpect(p.name, e.target.value)}
                    placeholder="expected value" />
                </div>
              ))}
            </div>
          </>}

          <div className="ts-btn-row">
            <button className="ts-btn ts-btn-primary" onClick={runTest} disabled={running}>
              ▶ {running ? 'running...' : 'run test'}
            </button>
            <button className="ts-btn" onClick={autoGen}>✨ auto-fill</button>
            <button className="ts-btn" onClick={() => {
              const blob = new Blob([JSON.stringify(inputs, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${subp.name}_inputs.json`;
              a.click();
            }}>⬇ export inputs</button>
          </div>

          {lastResult && (
            <div className={`ts-result-box ts-result-${lastResult.status}`}>
              <div className="ts-result-header">
                <span>{lastResult.status === 'pass' ? '✓' : '✗'}</span>
                <span>{lastResult.message}</span>
                <span className="ts-result-time">{lastResult.elapsed_ms}ms</span>
              </div>
              {(lastResult.violations?.length ?? 0) > 0 && (
                <ul className="ts-violation-list">
                  {lastResult.violations!.map((v, i) => (
                    <li key={i} className="ts-mono">{v.variable} ({v.type}): {v.error}</li>
                  ))}
                </ul>
              )}
              {Object.keys(lastResult.actual || {}).length > 0 && (
                <div className="ts-result-table ts-mono">
                  {Object.entries(lastResult.actual).map(([k, v]) => (
                    <div key={k} className="ts-result-row">
                      <span>{k}</span>
                      <span className="ts-result-expected">expected: {expected[k]}</span>
                      <span className={`ts-result-actual ${v === expected[k] ? 'ok' : 'bad'}`}>actual: {v}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="ts-result-types ts-mono">
                normalized: {JSON.stringify(lastResult.normalized_types || {})}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VARIABLES TAB */}
      {activeTab === 'variables' && (
        <div className="ts-input-section">
          <div className="ts-section-label">variables — declared type vs normalized</div>
          {subp.variables.length === 0
            ? <div className="ts-empty-state" style={{ padding: '1rem 0' }}>no variables extracted</div>
            : <table className="ts-vars-table">
                <thead>
                  <tr><th>name</th><th>declared type</th><th>normalized</th><th>scope</th><th>constraint</th></tr>
                </thead>
                <tbody>
                  {subp.variables.map((v, i) => (
                    <tr key={i}>
                      <td className="ts-mono">{v.name}</td>
                      <td className="ts-mono">{v.type} <CaseBadge type={v.type} /></td>
                      <td className="ts-mono" style={{ color: '#1D9E75' }}>{v.type_normalized}</td>
                      <td><span className={`ts-scope-pill ts-scope-${v.scope}`}>{v.scope}</span></td>
                      <td className="ts-mono" style={{ fontSize: 11 }}>
                        {v.constraint.kind === 'integer'
                          ? `${v.constraint.min} .. ${v.constraint.max}`
                          : v.constraint.kind || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="ts-input-section">
          <div className="ts-section-label">test run history for {subp.name}</div>
          {prevResults.length === 0
            ? <div className="ts-empty-state" style={{ padding: '1rem 0' }}>no tests run yet</div>
            : prevResults.slice().reverse().map(r => (
                <div key={r.id} className={`ts-history-row ts-result-${r.status}`}>
                  <StatusDot status={r.status} />
                  <span className="ts-mono" style={{ fontSize: 11, minWidth: 60 }}>{r.id}</span>
                  <span style={{ fontSize: 11, minWidth: 70 }}>{r.timestamp}</span>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{r.status}</span>
                  <span className="ts-mono" style={{ fontSize: 10, color: '#888780', flex: 1 }}>
                    {JSON.stringify(r.inputs)}
                  </span>
                </div>
              ))}
        </div>
      )}
    </div>
  );
}

// ── ResultsSidebar ────────────────────────────────────────────────────────────

function ResultsSidebar({ testResults, subprograms, onSelect }: {
  testResults: TestResult[];
  subprograms: Subprogram[];
  onSelect: (s: Subprogram) => void;
}) {
  return (
    <div style={{ width: 180, borderLeft: '0.5px solid rgba(0,0,0,0.12)', background: '#f7f6f3', overflowY: 'auto', flexShrink: 0 }}>
      <div className="ts-panel-head">📋 results</div>
      {testResults.length === 0
        ? <div style={{ padding: '8px 12px', fontSize: 11, color: '#888780' }}>no tests run yet</div>
        : testResults.slice().reverse().map((r, i) => (
            <div key={r.id || i} className="ts-result-item"
              onClick={() => { const s = subprograms.find(s => s.name === r.subprogram); if (s) onSelect(s); }}>
              <StatusDot status={r.status} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 500 }}>{r.subprogram}</div>
                <div style={{ fontSize: 10, color: '#888780' }}>{r.timestamp} · {r.status}</div>
              </div>
            </div>
          ))}
    </div>
  );
}

// ── Main TestStudioPanel ──────────────────────────────────────────────────────

export const TestStudioPanel: React.FC = () => {
  const [subprograms, setSubprograms] = useState<Subprogram[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [activeSubp,  setActiveSubp]  = useState<Subprogram | null>(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [statusMsg,   setStatusMsg]   = useState('');
  const [projectPath, setProjectPath] = useState('');

  // BUG FIX 5: useRef for path input
  const pathRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [s, r] = await Promise.all([
      apiGet<Subprogram[]>('/subprograms'),
      apiGet<TestResult[]>('/test/results'),
    ]);
    if (Array.isArray(s)) setSubprograms(s);
    if (Array.isArray(r)) setTestResults(r);
  }, []);

  // On mount: load any existing session data
  useEffect(() => { refresh(); }, [refresh]);

  const analyze = async (path: string) => {
    if (!path) { setStatusMsg('⚠ enter a project path first'); return; }
    setAnalyzing(true);
    setStatusMsg('analyzing...');
    setActiveSubp(null);

    const result = await apiPost<{ ok: boolean; file_count: number; subprogram_count: number; error?: string }>(
      '/analyze', { path }
    );

    if ((result as { error?: string }).error) {
      setStatusMsg(`error: ${(result as { error: string }).error}`);
    } else {
      setProjectPath(path);
      setStatusMsg(`✓ found ${result.file_count} file(s), ${result.subprogram_count} subprogram(s)`);
      await refresh();
    }
    setAnalyzing(false);
  };

  const runTest = async (
    subpName: string,
    inputs: Record<string, string>,
    expected: Record<string, string>
  ): Promise<TestResult> => {
    const result = await apiPost<TestResult>('/test/run', { subprogram: subpName, inputs, expected });
    const entry: TestResult = {
      ...result,
      subprogram: subpName,
      timestamp: new Date().toLocaleTimeString(),
      inputs,
      expected,
    };
    setTestResults(prev => [...prev, entry]);
    return entry;
  };

  const passed  = testResults.filter(r => r.status === 'pass').length;
  const failed  = testResults.filter(r => r.status === 'fail' || r.status === 'error').length;
  const pending = Math.max(0, subprograms.length - new Set(testResults.map(r => r.subprogram)).size);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f0efe9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 13 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.12)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}>🧪</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap' }}>Ada Test Studio</span>

        {/* Path input + analyze button */}
        <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 200 }}>
          <input
            ref={pathRef}
            className="ts-path-input"
            defaultValue={projectPath}
            placeholder="path/to/ada/project or folder"
            onKeyDown={e => { if (e.key === 'Enter') analyze(pathRef.current?.value.trim() ?? ''); }}
            style={{ flex: 1 }}
          />
          <button className="ts-btn ts-btn-primary" disabled={analyzing}
            onClick={() => analyze(pathRef.current?.value.trim() ?? '')}>
            {analyzing ? '⏳' : '🔄'} analyze
          </button>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <span className="ts-stat-pill pass">{passed} passed</span>
          <span className="ts-stat-pill fail">{failed} failed</span>
          <span className="ts-stat-pill pend">{pending} pending</span>
        </div>

        {/* Clear + Export */}
        {testResults.length > 0 && (
          <button className="ts-btn" style={{ fontSize: 11 }}
            onClick={async () => { await apiPost('/test/clear', {}); setTestResults([]); }}>
            🗑 clear
          </button>
        )}
        <a href="/api/export" target="_blank" rel="noreferrer"
          className="ts-btn" style={{ fontSize: 11, textDecoration: 'none' }}>
          ⬇ export
        </a>
      </div>

      {/* Status bar */}
      {statusMsg && (
        <div className="ts-status-bar" style={{ flexShrink: 0 }}>
          {statusMsg}
          <button className="ts-status-close" onClick={() => setStatusMsg('')}>×</button>
        </div>
      )}

      {/* Main workspace: subprogram list | test panel | results sidebar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SubprogramList
          subprograms={subprograms}
          activeSubp={activeSubp}
          testResults={testResults}
          onSelect={setActiveSubp}
        />

        <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
          <TestPanel
            subp={activeSubp}
            testResults={testResults}
            onRunTest={runTest}
          />
        </div>

        <ResultsSidebar
          testResults={testResults}
          subprograms={subprograms}
          onSelect={setActiveSubp}
        />
      </div>
    </div>
  );
};
