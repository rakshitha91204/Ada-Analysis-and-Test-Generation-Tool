import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, Download, Play, ChevronDown, BarChart2, Code2 } from 'lucide-react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { useParseStore } from '../../store/useParseStore';
import { useFileStore } from '../../store/useFileStore';
import { TestCaseCard } from './TestCaseCard';
import { TestCaseHistory } from './TestCaseHistory';
import { CoverageHeatmap } from './CoverageHeatmap';
import { TestStatsPanel } from '../shared/TestStatsPanel';
import { EmptyState } from '../shared/EmptyState';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';
import { TestTube } from 'lucide-react';
import '../../styles/TestStudio.css';
import type { AdaAnalysisResult } from '../../utils/adaAnalyzer';

// ── Test Studio types ─────────────────────────────────────────────────────────
interface TypeConstraint {
  kind: 'integer'|'float'|'boolean'|'character'|'string'|'unknown';
  min?: number; max?: number; values?: string[];
}
interface StudioParam {
  name: string; dir: 'in'|'out'|'in out';
  type: string; type_normalized: string; constraint: TypeConstraint;
}
interface StudioVariable {
  name: string; type: string; type_normalized: string;
  scope: 'local'|'global'|'constant'; constraint: TypeConstraint;
}
interface StudioSubprogram {
  name: string; file: string; file_name: string;
  start_line: number|null; end_line: number|null;
  return_type: string|null; params: StudioParam[];
  variables: StudioVariable[]; complexity: number|null;
  is_dead: boolean; calls: string[];
}
interface TestRunResult {
  id?: string; subprogram: string; timestamp: string;
  status: 'pass'|'fail'|'error'; message: string;
  explanation?: string;
  actual: Record<string,string>; elapsed_ms: number;
  violations?: Array<{variable:string;type:string;value:string;error:string}>;
  normalized_types?: Record<string,string>;
  inputs: Record<string,string>; expected: Record<string,string>;
}

// ── Build StudioSubprogram from local analysis result (no extra API call) ─────
function typeConstraint(type: string): TypeConstraint {
  const tl = (type||'').toLowerCase().trim();
  if (tl.includes('uint16'))   return { kind:'integer', min:0, max:65535 };
  if (tl.includes('uint32'))   return { kind:'integer', min:0, max:4294967295 };
  if (tl.includes('uint8'))    return { kind:'integer', min:0, max:255 };
  if (tl.includes('positive')) return { kind:'integer', min:1, max:2147483647 };
  if (tl.includes('natural'))  return { kind:'integer', min:0, max:2147483647 };
  if (tl.includes('integer'))  return { kind:'integer', min:-2147483648, max:2147483647 };
  if (tl.includes('float'))    return { kind:'float', min:-1e38, max:1e38 };
  if (tl.includes('boolean'))  return { kind:'boolean', values:['True','False'] };
  if (tl.includes('character'))return { kind:'character' };
  if (tl.includes('string'))   return { kind:'string' };
  return { kind:'unknown' };
}

function buildStudioSubprogram(
  subpName: string,
  analysis: AdaAnalysisResult
): StudioSubprogram | null {
  if (!subpName) return null;
  const nameLower = subpName.toLowerCase();

  // Find the subprogram entry — case-insensitive, also try partial match
  let entry: { name:string; parameters:string[]; return_type:string|null; start_line:number; end_line:number } | null = null;
  let filePath = '';
  for (const [fp, subs] of Object.entries(analysis.subprogram_index || {})) {
    // Exact match first
    let found = subs.find(s => s.name === subpName);
    // Case-insensitive fallback
    if (!found) found = subs.find(s => s.name.toLowerCase() === nameLower);
    // Partial match fallback (subpName contains the name or vice versa)
    if (!found) found = subs.find(s =>
      s.name.toLowerCase().includes(nameLower) || nameLower.includes(s.name.toLowerCase())
    );
    if (found) { entry = found; filePath = fp; break; }
  }
  if (!entry) return null;

  // Use the actual name from the index (may differ in case)
  const actualName = entry.name;

  // Parse raw parameter strings into structured params
  // Backend format after fix: each entry is one param "Name : in Type"
  // Legacy format (before fix): all params in one string separated by ";\n"
  const params: StudioParam[] = [];
  for (const raw of (entry.parameters || [])) {
    // Normalise: collapse whitespace, split on semicolons for legacy multi-param strings
    const segments = raw.split(';').map(s => s.trim()).filter(Boolean);
    for (const segment of segments) {
      const colonIdx = segment.indexOf(':');
      if (colonIdx === -1) continue;
      const namesPart = segment.slice(0, colonIdx).trim();
      const rest = segment.slice(colonIdx + 1).trim();
      let dir: 'in'|'out'|'in out' = 'in';
      let typePart = rest;
      if (/^in\s+out\b/i.test(rest))  { dir = 'in out'; typePart = rest.replace(/^in\s+out\s*/i, ''); }
      else if (/^out\b/i.test(rest))  { dir = 'out';    typePart = rest.replace(/^out\s*/i, ''); }
      else if (/^in\b/i.test(rest))   { dir = 'in';     typePart = rest.replace(/^in\s*/i, ''); }
      const type = typePart.trim();
      for (const pname of namesPart.split(',')) {
        const n = pname.trim();
        if (n) params.push({ name:n, dir, type, type_normalized:type.toLowerCase(), constraint:typeConstraint(type) });
      }
    }
  }

  // Build variables from variables_info — use actualName for lookup
  const variables: StudioVariable[] = [];
  const fileVars = (analysis.variables_info || {})[filePath] || {};
  const locals  = (fileVars.local_variables  || {})[actualName] || {};
  const globals = (fileVars.global_variables || {})[actualName] || {};
  const consts  = (fileVars.global_constants || {})[actualName] || {};
  for (const [vname, vdata] of Object.entries(locals)) {
    const t = (vdata as {type:string}).type || 'Unknown';
    variables.push({ name:vname, type:t, type_normalized:t.toLowerCase(), scope:'local', constraint:typeConstraint(t) });
  }
  for (const [vname, vdata] of Object.entries(globals)) {
    const t = (vdata as {type:string}).type || 'Unknown';
    variables.push({ name:vname, type:t, type_normalized:t.toLowerCase(), scope:'global', constraint:typeConstraint(t) });
  }
  for (const [vname, vdata] of Object.entries(consts)) {
    const t = (vdata as {type:string}).type || 'Unknown';
    variables.push({ name:vname, type:t, type_normalized:t.toLowerCase(), scope:'constant', constraint:typeConstraint(t) });
  }

  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  const complexity = (analysis.cyclomatic_complexity || {})[actualName] ?? null;
  const isDead = (analysis.dead_code || []).includes(actualName);
  const calls = (analysis.call_graph || {})[actualName] || [];

  return {
    name: actualName, file: filePath, file_name: fileName,
    start_line: entry.start_line ?? null, end_line: entry.end_line ?? null,
    return_type: entry.return_type ?? null,
    params, variables, complexity, is_dead: isDead, calls,
  };
}

// ── Test Studio helpers ───────────────────────────────────────────────────────
function typeDefault(type: string): string {
  const tl = (type||'').toLowerCase();
  if (tl.includes('bool'))      return 'False';
  if (tl.includes('float'))     return '0.0';
  if (tl.includes('character')) return "'A'";
  if (tl.includes('string'))    return '"Hello"';
  return '0';
}
function typeLabel(type: string): string {
  const tl = (type||'').toLowerCase();
  if (tl.includes('uint16'))   return '0 .. 65535';
  if (tl.includes('uint32'))   return '0 .. 4294967295';
  if (tl.includes('uint8'))    return '0 .. 255';
  if (tl.includes('positive')) return '1 .. 2147483647';
  if (tl.includes('natural'))  return '0 .. 2147483647';
  if (tl.includes('integer'))  return '-2147483648 .. 2147483647';
  if (tl.includes('float'))    return 'float';
  if (tl.includes('bool'))     return 'True | False';
  return '';
}
function CaseBadge({ type }: { type: string }) {
  const t = type||'', tl = t.toLowerCase();
  if (t === t.toUpperCase() && t !== tl)
    return <span className="ts-badge ts-badge-caps">CAPS</span>;
  if (t === tl)
    return <span className="ts-badge ts-badge-lower">lower</span>;
  return <span className="ts-badge ts-badge-orig">orig</span>;
}
function StatusDot({ status }: { status: string }) {
  const c: Record<string,string> = { pass:'#1D9E75', fail:'#E24B4A', error:'#BA7517', none:'#B4B2A9' };
  return <span className="ts-status-dot" style={{ background: c[status]||c.none }} />;
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function studioPost<T>(path: string, body: unknown): Promise<T> {
  // Try Vite proxy first (/api/*), then direct backend as fallback
  const urls = ['/api' + path, 'http://localhost:8001/api' + path];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json') || ct.includes('text/')) {
        return r.json();
      }
      // Non-JSON response from proxy (HTML fallback) — try next URL
      continue;
    } catch {
      // Network error — try next URL
    }
  }
  return { error: 'Could not connect to backend on port 8001' } as unknown as T;
}

async function studioGet<T>(path: string): Promise<T> {
  const urls = ['/api' + path, 'http://localhost:8001/api' + path];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('application/json')) return r.json();
      if (r.ok) return r.json();
    } catch {
      // try next
    }
  }
  return [] as unknown as T;
}

// ── TestStudioInputs — the full input/variables/history UI ───────────────────
const TestStudioInputs: React.FC<{ subpName: string; analysis: AdaAnalysisResult | null }> = ({ subpName, analysis }) => {
  const [studioSubp, setStudioSubp] = useState<StudioSubprogram|null>(null);
  const [inputs,     setInputs]     = useState<Record<string,string>>({});
  const [expected,   setExpected]   = useState<Record<string,string>>({});
  const [running,    setRunning]    = useState(false);
  const [lastResult, setLastResult] = useState<TestRunResult|null>(null);
  const [history,    setHistory]    = useState<TestRunResult[]>([]);
  const [activeTab,  setActiveTab]  = useState<'inputs'|'variables'|'history'>('inputs');

  // Build enriched subprogram — local parse store first, then API
  useEffect(() => {
    if (!subpName || !analysis) { setStudioSubp(null); return; }

    const applySubp = (found: StudioSubprogram) => {
      setStudioSubp(found);
      const inPs = found.params.filter(p => p.dir === 'in' || p.dir === 'in out');
      const outPs = found.params.filter(p => p.dir === 'out' || p.dir === 'in out');
      const hasNoParams = inPs.length === 0 && outPs.length === 0;
      const init: Record<string,string> = {};
      inPs.forEach(p => { init[p.name] = typeDefault(p.type); });
      setInputs(init);
      const exp: Record<string,string> = {};
      outPs.forEach(p => { exp[p.name] = typeDefault(p.type); });
      setExpected(exp);
      setLastResult(null);
      setActiveTab(hasNoParams ? 'variables' : 'inputs');
    };

    // 1. Try local parse store (fastest — no network)
    const local = buildStudioSubprogram(subpName, analysis);
    if (local) {
      applySubp(local);
      // Also try to enrich from API in background (has richer constraint data)
      studioGet<StudioSubprogram[]>('/subprograms').then(list => {
        const api = list.find(s =>
          s.name === local.name || s.name.toLowerCase() === local.name.toLowerCase()
        );
        if (api && api.params.length >= local.params.length) {
          // API has richer param data — merge variables from local into API result
          const merged: StudioSubprogram = {
            ...api,
            variables: api.variables.length > 0 ? api.variables : local.variables,
          };
          applySubp(merged);
        }
      }).catch(() => {/* API not available — local data is fine */});
      return;
    }

    // 2. Fallback: API only
    studioGet<StudioSubprogram[]>('/subprograms').then(list => {
      const found = list.find(s =>
        s.name === subpName || s.name.toLowerCase() === subpName.toLowerCase()
      );
      if (found) applySubp(found);
      else setStudioSubp(null);
    });
  }, [subpName, analysis]); // eslint-disable-line

  // Track which autofill strategy to use next (cycles: normal → edge → boundary → random)
  const autoFillStrategyRef = useRef<'normal'|'edge'|'boundary'|'random'>('normal');
  const strategyOrder: Array<'normal'|'edge'|'boundary'|'random'> = ['normal','edge','boundary','random'];

  /** Smart default for any Ada type using name + type hints */
  const smartDefault = (paramName: string, type: string, c: TypeConstraint, strategy: string): string => {
    const tl = type.toLowerCase();
    const pl = paramName.toLowerCase();

    if (c.kind === 'integer') {
      const lo = c.min ?? 0, hi = c.max ?? 255;
      const mid = Math.floor((lo + hi) / 2);
      const spread = Math.max(1, Math.floor((hi - lo) / 4));
      if (strategy === 'edge')     return String(Math.random() > 0.5 ? lo : hi);
      if (strategy === 'boundary') return String(Math.random() > 0.5 ? lo : Math.max(hi - 1, lo));
      if (strategy === 'random')   return String(lo + Math.floor(Math.random() * Math.min(1000, hi - lo + 1)));
      return String(mid - spread + Math.floor(Math.random() * spread * 2));
    }
    if (c.kind === 'float')    return strategy === 'edge' ? '0.0' : (Math.random() * 10).toFixed(2);
    if (c.kind === 'boolean')  return strategy === 'edge' ? 'False' : (Math.random() > 0.5 ? 'True' : 'False');
    if (c.kind === 'character') {
      if (strategy === 'edge') return "' '";
      return "'" + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*52)] + "'";
    }
    if (c.kind === 'string')   return strategy === 'edge' ? '""' : '"Hello"';

    // Unknown type — use name/type hints (same logic as backend)
    if (tl.includes('font')    || pl.includes('font'))    return 'Default_Font';
    if (tl.includes('buffer')  || pl.includes('buffer') || pl.includes('buf')) return 'Default_Buffer';
    if (tl.includes('color')   || pl.includes('color'))   return '0';
    if (tl.includes('point')   || pl === 'start' || pl === 'pos' || pl.includes('position')) return '(0, 0)';
    if (tl.includes('bitmap')  || pl.includes('bitmap'))  return 'Default_Bitmap';
    if (pl.includes('width')   || pl.includes('height'))  return '1';
    if (pl.includes('size')    || pl.includes('length'))  return '1';
    if (pl.includes('index')   || pl.includes('idx'))     return '1';
    if (pl.includes('count')   || pl.includes('num'))     return '1';
    if (pl.includes('offset'))                            return '0';
    if (pl.includes('char')    || tl.includes('char'))    return "'A'";
    if (pl.includes('str')     || tl.includes('string'))  return '"Hello"';
    return '0';
  };

  const autoGen = async () => {
    if (!studioSubp) return;

    const strategy = autoFillStrategyRef.current;
    const nextIdx = (strategyOrder.indexOf(strategy) + 1) % strategyOrder.length;
    autoFillStrategyRef.current = strategyOrder[nextIdx];

    try {
      // Try the backend API first
      const res = await studioPost<{
        values: Record<string,string>;
        strategy: string;
        note?: string;
      }>('/autofill', { subprogram: studioSubp.name, strategy });

      // Only use API values if non-empty (session has this subprogram)
      if (res.values && Object.keys(res.values).length > 0) {
        setInputs(prev => ({ ...prev, ...res.values }));
        return;
      }
    } catch {
      // Fall through to local
    }

    // Local fallback — uses smartDefault with name+type hints
    const next: Record<string,string> = {};
    studioSubp.params
      .filter(p => p.dir === 'in' || p.dir === 'in out')
      .forEach(p => {
        next[p.name] = smartDefault(p.name, p.type, p.constraint, strategy);
      });
    setInputs(next);
  };

  const runTest = async () => {
    if (!studioSubp) return;
    setRunning(true);

    try {
      const res = await studioPost<TestRunResult & { error?: string }>('/test/run', {
        subprogram: studioSubp.name,
        inputs,
        expected,
      });

      // Handle backend error response
      if ((res as { error?: string }).error) {
        const errMsg = (res as { error: string }).error;
        const entry: TestRunResult = {
          subprogram: studioSubp.name,
          timestamp: new Date().toLocaleTimeString(),
          status: 'error',
          message: 'Backend connection error',
          explanation: `${errMsg}. Make sure the backend is running at http://localhost:8001 and the file has been uploaded and parsed.`,
          actual: {},
          elapsed_ms: 0,
          inputs,
          expected,
        };
        setLastResult(entry);
        setHistory(h => [entry, ...h]);
        setRunning(false);
        return;
      }

      // Ensure status is always valid
      const status = (res.status as string) || 'pass';
      const entry: TestRunResult = {
        ...res,
        status: (status === 'pass' || status === 'fail' || status === 'error') ? status : 'pass',
        subprogram: studioSubp.name,
        timestamp: new Date().toLocaleTimeString(),
        inputs,
        expected,
      };
      setLastResult(entry);
      setHistory(h => [entry, ...h]);
    } catch (e) {
      const entry: TestRunResult = {
        subprogram: studioSubp.name,
        timestamp: new Date().toLocaleTimeString(),
        status: 'error',
        message: 'Network error',
        explanation: `Could not reach backend: ${(e as Error).message}. Make sure the backend is running on port 8001.`,
        actual: {},
        elapsed_ms: 0,
        inputs,
        expected,
      };
      setLastResult(entry);
      setHistory(h => [entry, ...h]);
    }
    setRunning(false);
  };

  if (!studioSubp) return (
    <div className="px-3 py-2 text-xs font-mono text-zinc-500">
      {analysis
        ? `⚠ no parameter info found for "${subpName}" — parse the file first`
        : '⚠ parse a file first to see inputs and variables'}
    </div>
  );

  // BUG FIX 4: exact direction comparison
  const inParams  = studioSubp.params.filter(p => p.dir === 'in' || p.dir === 'in out');
  const outParams = studioSubp.params.filter(p => p.dir === 'out' || p.dir === 'in out');
  const hasNoParams = inParams.length === 0 && outParams.length === 0;

  return (
    <div className="ts-dark border rounded-lg overflow-hidden flex-shrink-0 mb-3"
      style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.03)' }}>

      {/* Header */}
      <div style={{ padding: '10px 14px 6px', borderBottom: '0.5px solid rgba(250,204,21,0.15)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7' }}>{studioSubp.name}</div>
        <div style={{ fontSize: 11, color: '#71717a', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
          <span>{studioSubp.file_name}</span>
          {studioSubp.start_line && <span>· lines {studioSubp.start_line}–{studioSubp.end_line}</span>}
          {studioSubp.complexity  && <span>· complexity {studioSubp.complexity}</span>}
          {studioSubp.is_dead && <span className="ts-badge ts-badge-dead" style={{ fontSize: 10 }}>dead code</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid rgba(250,204,21,0.15)' }}>
        {(['inputs','variables','history'] as const).map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 14px', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? '2px solid #f59e0b' : '2px solid transparent',
              color: activeTab === tab ? '#f59e0b' : '#71717a', fontWeight: activeTab === tab ? 600 : 400,
            }}>
            {tab}
            {tab === 'history' && history.length > 0 &&
              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>({history.length})</span>}
          </button>
        ))}
      </div>

      {/* INPUTS TAB */}
      {activeTab === 'inputs' && (
        <div style={{ padding: '12px 14px' }}>
          {hasNoParams ? (
            <div style={{ padding: '8px 0 12px', fontSize: 12, color: '#71717a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>ƒ</span>
              <span>
                <strong style={{ color: '#a1a1aa' }}>{studioSubp.name}</strong> has no parameters.
                {studioSubp.variables.length > 0
                  ? <> See the <button onClick={() => setActiveTab('variables')} style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}>variables tab</button> for declared variables.</>
                  : ' This is a parameterless procedure.'}
              </span>
            </div>
          ) : (
            <>
              {/* IN PARAMETERS */}
              {inParams.length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px' }}>in parameters — set test values</div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {inParams.map(p => (
                    <div key={p.name} className="ts-input-card">
                      <div className="ts-input-header">
                        <span className="ts-input-dir">{p.dir}</span>
                        <span className="ts-input-name">{p.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">{p.type} <CaseBadge type={p.type} /></div>
                      {typeLabel(p.type) && <div className="ts-input-range">{typeLabel(p.type)}</div>}
                      {p.constraint.kind === 'boolean'
                        ? <select className="ts-input-field"
                            value={inputs[p.name]??'False'}
                            onChange={e => setInputs(i => ({...i,[p.name]:e.target.value}))}>
                            <option>False</option><option>True</option>
                          </select>
                        : <input className="ts-input-field"
                            type={p.constraint.kind==='integer'?'number':'text'}
                            value={inputs[p.name]??typeDefault(p.type)}
                            onChange={e => setInputs(i => ({...i,[p.name]:e.target.value}))}
                            min={p.constraint.min} max={p.constraint.max} />}
                    </div>
                  ))}
                </div>
              </>}

              {/* OUT PARAMETERS */}
              {outParams.length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px' }}>expected output values</div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {outParams.map(p => (
                    <div key={p.name} className="ts-input-card ts-input-card-out">
                      <div className="ts-input-header">
                        <span className="ts-input-dir out">out</span>
                        <span className="ts-input-name">{p.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">{p.type} <CaseBadge type={p.type} /></div>
                      {typeLabel(p.type) && <div className="ts-input-range">{typeLabel(p.type)}</div>}
                      <input className="ts-input-field" type="text"
                        value={expected[p.name]??typeDefault(p.type)}
                        onChange={e => setExpected(ex => ({...ex,[p.name]:e.target.value}))}
                        placeholder="expected value" />
                    </div>
                  ))}
                </div>
              </>}

              {/* LOCAL VARIABLES — shown inline as read-only context */}
              {studioSubp.variables.filter(v => v.scope === 'local').length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#52525b' }}>
                  local variables — declared in subprogram
                </div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {studioSubp.variables.filter(v => v.scope === 'local').map((v, i) => (
                    <div key={i} className="ts-input-card" style={{ opacity: 0.7 }}>
                      <div className="ts-input-header">
                        <span className="ts-input-dir" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 9 }}>local</span>
                        <span className="ts-input-name">{v.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">{v.type} <CaseBadge type={v.type} /></div>
                      {typeLabel(v.type) && <div className="ts-input-range">{typeLabel(v.type)}</div>}
                      <input className="ts-input-field ts-mono"
                        value={typeDefault(v.type)}
                        readOnly
                        style={{ opacity: 0.6, cursor: 'default', background: 'transparent' }}
                        title="Local variable — default initial value shown" />
                    </div>
                  ))}
                </div>
              </>}

              {/* CONSTANTS — shown with their value */}
              {studioSubp.variables.filter(v => v.scope === 'constant').length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#52525b' }}>
                  constants
                </div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {studioSubp.variables.filter(v => v.scope === 'constant').map((v, i) => (
                    <div key={i} className="ts-input-card" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                      <div className="ts-input-header">
                        <span className="ts-input-dir" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 9 }}>const</span>
                        <span className="ts-input-name">{v.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">{v.type} <CaseBadge type={v.type} /></div>
                      <input className="ts-input-field ts-mono"
                        value={typeDefault(v.type)}
                        readOnly
                        style={{ opacity: 0.7, cursor: 'default', borderColor: 'rgba(245,158,11,0.3)' }}
                        title="Constant — value is fixed at declaration" />
                    </div>
                  ))}
                </div>
              </>}
            </>
          )}

          {/* Buttons */}
          <div className="ts-btn-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <button className="ts-btn ts-btn-primary" onClick={runTest} disabled={running}>
              ▶ {running ? 'running...' : 'run test'}
            </button>
            {!hasNoParams && <button className="ts-btn" onClick={autoGen}>
              ✨ auto-fill <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>({autoFillStrategyRef.current})</span>
            </button>}
            {!hasNoParams && <button className="ts-btn" onClick={() => {
              const blob = new Blob([JSON.stringify(inputs, null, 2)], {type:'application/json'});
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `${studioSubp.name}_inputs.json`; a.click();
            }}>⬇ export inputs</button>}
          </div>

          {/* Result box — with explanation */}
          {lastResult && (
            <div className={`ts-result-box ts-result-${lastResult.status || 'error'}`} style={{ marginTop: 12, marginLeft: 0, marginRight: 0 }}>
              <div className="ts-result-header">
                <StatusDot status={lastResult.status || 'error'} />
                <span style={{ fontWeight: 600 }}>
                  {lastResult.status === 'pass' ? '✓ PASS'
                   : lastResult.status === 'fail' ? '✗ FAIL'
                   : '⚠ ERROR'}
                </span>
                {lastResult.message && (
                  <span style={{ fontWeight: 400, fontSize: 11 }}>{lastResult.message}</span>
                )}
                <span className="ts-result-time">{lastResult.elapsed_ms ?? 0}ms</span>
              </div>

              {/* Explanation — always show something useful */}
              <div style={{ fontSize: 11, padding: '6px 0 8px', lineHeight: 1.5, fontFamily: 'inherit',
                color: lastResult.status === 'pass' ? '#4ade80' : lastResult.status === 'fail' ? '#f87171' : '#fbbf24' }}>
                {lastResult.explanation
                  || (lastResult.status === 'pass'
                    ? `✓ Test passed. Subprogram "${studioSubp.name}" executed successfully.`
                    : lastResult.status === 'fail'
                    ? `✗ Test failed. Check your expected output values against the actual results.`
                    : `⚠ Could not run test. The backend may not have "${studioSubp.name}" in its current session. Upload and parse the source file first.`)}
              </div>

              {/* Type violations */}
              {(lastResult.violations?.length ?? 0) > 0 && (
                <ul className="ts-violation-list">
                  {lastResult.violations!.map((v, i) => (
                    <li key={i} className="ts-mono">{v.variable} ({v.type}): {v.error}</li>
                  ))}
                </ul>
              )}

              {/* Actual vs expected */}
              {Object.keys(lastResult.actual || {}).length > 0 && (
                <div className="ts-result-table ts-mono" style={{ marginTop: 6 }}>
                  {Object.entries(lastResult.actual).map(([k, v]) => (
                    <div key={k} className="ts-result-row">
                      <span style={{ minWidth: 80 }}>{k}</span>
                      <span className="ts-result-expected">expected: {expected[k] ?? '—'}</span>
                      <span className={`ts-result-actual ${v === expected[k] ? 'ok' : 'bad'}`}>
                        actual: {v}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VARIABLES TAB */}
      {activeTab === 'variables' && (
        <div style={{ padding: '12px 14px' }}>
          <div className="ts-section-label" style={{ padding: '0 0 8px' }}>
            variables — declared type vs normalized
          </div>
          {studioSubp.variables.length === 0
            ? <div style={{ fontSize: 12, color: '#71717a', padding: '8px 0' }}>no variables extracted</div>
            : <table className="ts-vars-table">
                <thead>
                  <tr>
                    <th>name</th><th>declared type</th><th>normalized</th><th>scope</th><th>constraint</th>
                  </tr>
                </thead>
                <tbody>
                  {studioSubp.variables.map((v,i) => (
                    <tr key={i}>
                      <td className="ts-mono">{v.name}</td>
                      <td className="ts-mono">{v.type} <CaseBadge type={v.type} /></td>
                      <td className="ts-mono" style={{ color: '#4ade80' }}>{v.type_normalized}</td>
                      <td><span className={`ts-scope-pill ts-scope-${v.scope}`}>{v.scope}</span></td>
                      <td className="ts-mono" style={{ fontSize: 11 }}>
                        {v.constraint.kind==='integer' ? `${v.constraint.min} .. ${v.constraint.max}` : v.constraint.kind||'—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div style={{ padding: '12px 14px' }}>
          <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#71717a' }}>
            test run history for {studioSubp.name}
          </div>
          {history.length === 0
            ? <div style={{ fontSize: 12, color: '#71717a', padding: '8px 0' }}>no tests run yet</div>
            : history.map((r,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0',
                  borderBottom:'0.5px solid rgba(255,255,255,0.06)', fontSize:11 }}>
                  <StatusDot status={r.status} />
                  <span style={{ color:'#71717a', minWidth:60 }}>{r.timestamp}</span>
                  <span style={{ fontWeight:500, color: r.status==='pass'?'#4ade80':r.status==='fail'?'#f87171':'#fbbf24' }}>
                    {r.status}
                  </span>
                  <span className="ts-mono" style={{ fontSize:10, color:'#52525b', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {JSON.stringify(r.inputs)}
                  </span>
                </div>
              ))}
        </div>
      )}
    </div>
  );
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
    <div className="skeleton h-3 w-24 rounded" />
    <div className="skeleton h-3 w-48 rounded" />
    <div className="skeleton h-3 w-36 rounded" />
  </div>
);

// ── Main TestCasePanel ────────────────────────────────────────────────────────
export const TestCasePanel: React.FC = () => {
  const { subprograms: storeSubprograms, selectedSubprogramId, selectSubprogram } = useSubprogramStore();
  const { setSubprograms } = useSubprogramStore();
  const { currentTestSets, exportCurrent, exportAllHistory, exportCurrentAsADB, saveToHistory, setCurrentTests, generateTests } = useTestCaseStore();
  const [generating, setGenerating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showStats,  setShowStats]  = useState(false);
  const dragFrom = useRef<number|null>(null);
  const dragTo   = useRef<number|null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number|null>(null);

  const { results, activeResultFileId } = useParseStore();
  const { activeFileId } = useFileStore();

  // Build subprograms from parse store when the subprogram store is empty
  // This handles the case where the file was parsed but the store was cleared
  const parseStoreSubprograms = useMemo(() => {
    const subs: import('../../types/subprogram.types').Subprogram[] = [];
    for (const result of Object.values(results)) {
      if (result.subprograms?.length > 0) {
        subs.push(...result.subprograms);
      }
    }
    return subs;
  }, [results]);

  // Use store subprograms if available, otherwise fall back to parse store subprograms
  const subprograms = storeSubprograms.length > 0 ? storeSubprograms : parseStoreSubprograms;

  // If store is empty but parse store has data, sync them back into the store
  useEffect(() => {
    if (storeSubprograms.length === 0 && parseStoreSubprograms.length > 0) {
      setSubprograms(parseStoreSubprograms);
    }
  }, [storeSubprograms.length, parseStoreSubprograms, setSubprograms]);

  const selectedSub = subprograms.find(s => s.id === selectedSubprogramId);
  const tests = selectedSubprogramId ? (currentTestSets[selectedSubprogramId]||[]) : [];

  // Resolve subprogram name FIRST — from store, then search all parse results by ID substring
  const resolvedSubpName = (() => {
    if (selectedSub?.name) return selectedSub.name;
    if (!selectedSubprogramId) return '';
    for (const result of Object.values(results)) {
      for (const subs of Object.values(result.analysis?.subprogram_index || {})) {
        for (const s of subs) {
          if (selectedSubprogramId.includes(s.name)) return s.name;
        }
      }
    }
    return '';
  })();

  // Resolve active analysis — find the result that actually contains this subprogram
  const activeResult = (() => {
    if (activeResultFileId && results[activeResultFileId]) {
      const r = results[activeResultFileId];
      if (!resolvedSubpName || buildStudioSubprogram(resolvedSubpName, r.analysis)) return r;
    }
    if (activeFileId && results[activeFileId]) {
      const r = results[activeFileId];
      if (!resolvedSubpName || buildStudioSubprogram(resolvedSubpName, r.analysis)) return r;
    }
    if (resolvedSubpName) {
      for (const r of Object.values(results)) {
        if (buildStudioSubprogram(resolvedSubpName, r.analysis)) return r;
      }
    }
    const vals = Object.values(results);
    return vals.length > 0 ? vals[vals.length - 1] : null;
  })();
  const harnessTemplate = (() => {
    if (!resolvedSubpName || !activeResult?.analysis?.test_harness_data) return null;
    const allEntries = Object.values(activeResult.analysis.test_harness_data).flat();
    return allEntries.find(e => e.original_subprogram === resolvedSubpName) ?? null;
  })();
  const [showHarness, setShowHarness] = useState(false);

  const generateForSelected = useCallback(() => {
    if (!selectedSub) return;
    setGenerating(true);
    setTimeout(() => { generateTests(selectedSub); setGenerating(false); }, 300);
  }, [selectedSub, generateTests]);

  const generateForAll = useCallback(() => {
    setGenerating(true);
    let delay = 0;
    subprograms.forEach(s => { setTimeout(() => generateTests(s), delay); delay += 80; });
    setTimeout(() => setGenerating(false), delay + 200);
  }, [subprograms, generateTests]);

  useEffect(() => {
    if (selectedSubprogramId && !currentTestSets[selectedSubprogramId]?.length) generateForSelected();
  }, [selectedSubprogramId]); // eslint-disable-line

  const handleSaveToHistory = () => {
    const name = selectedSub?.name || resolvedSubpName;
    if (!name || !selectedSubprogramId) return;
    saveToHistory({ id: crypto.randomUUID(), subprogramId: selectedSubprogramId, subprogramName: name, timestamp: new Date().toISOString(), testCases: tests });
  };

  const handleDragStart = (idx: number) => { dragFrom.current = idx; setDraggingIdx(idx); };
  const handleDragOver  = (idx: number) => { dragTo.current = idx; };
  const handleDrop = () => {
    if (dragFrom.current===null||dragTo.current===null||!selectedSubprogramId) return;
    const reordered = [...tests];
    const [moved] = reordered.splice(dragFrom.current, 1);
    reordered.splice(dragTo.current, 0, moved);
    setCurrentTests(selectedSubprogramId, reordered);
    dragFrom.current = null; dragTo.current = null; setDraggingIdx(null);
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Left column */}
      <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: 'var(--border-default)' }}>

        {/* Subprogram selector */}
        <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
          <select value={selectedSubprogramId??''} onChange={e => selectSubprogram(e.target.value||null)}
            className="flex-1 px-2 py-1 text-xs font-mono rounded bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-amber-500/50">
            <option value="">— Select subprogram —</option>
            {subprograms.map(s => (
              <option key={s.id} value={s.id}>{s.kind==='function'?'ƒ':'⚡'} {s.name}</option>
            ))}
          </select>
          <Button variant={showStats?'primary':'ghost'} size="sm" icon={<BarChart2 size={11} />} onClick={() => setShowStats(v => !v)}>Stats</Button>
        </div>

        {/* Stats + coverage */}
        {showStats && (
          <div className="p-3 border-b flex flex-col gap-3 flex-shrink-0" style={{ borderColor: 'var(--border-default)' }}>
            <TestStatsPanel /><CoverageHeatmap />
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {!selectedSubprogramId ? (
            <EmptyState icon={<TestTube size={28} />} heading="Select a subprogram" subtext="Test cases will be auto-generated on selection." />
          ) : (
            <>
              {/* ── TEST STUDIO INPUTS — shown at top when subprogram selected ── */}
              <TestStudioInputs subpName={resolvedSubpName} analysis={activeResult?.analysis ?? null} />

              {/* Action bar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" icon={<RefreshCw size={11} />} loading={generating} onClick={generateForSelected}>Regenerate</Button>
                <Button variant="ghost" size="sm" icon={<Play size={11} />} onClick={generateForAll}>All</Button>
                <Button variant="ghost" size="sm" onClick={handleSaveToHistory}>Save</Button>
                <div className="relative ml-auto">
                  <Button variant="secondary" size="sm" icon={<Download size={11} />} onClick={() => setExportOpen(v => !v)}>
                    Export <ChevronDown size={10} />
                  </Button>
                  {exportOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-xl overflow-hidden"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', minWidth: 210 }}>
                      {[
                        { label: 'Download current as JSON', action: () => exportCurrent(selectedSubprogramId!, resolvedSubpName||selectedSub?.name||'') },
                        { label: 'Download all history as JSON', action: exportAllHistory },
                        { label: 'Download as .adb stub', action: () => exportCurrentAsADB(selectedSubprogramId!, resolvedSubpName||selectedSub?.name||'') },
                        { label: 'Export as CSV', action: () => exportAsCSV(tests, resolvedSubpName||selectedSub?.name||'tests') },
                      ].map(item => (
                        <button key={item.label} onClick={() => { item.action(); setExportOpen(false); }}
                          className="w-full text-left px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-zinc-700/50 transition-colors">
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Test case count */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Generated Test Cases</span>
                <Badge variant="primary" animate={tests.length>0}>{tests.length} 🧪</Badge>
                {tests.some(t => t.runStatus==='pass') && (
                  <span className="text-[10px] font-mono text-green-400 ml-auto">
                    {tests.filter(t => t.runStatus==='pass').length}/{tests.length} pass
                  </span>
                )}
              </div>

              {/* Backend harness template */}
              {harnessTemplate && (
                <div className="rounded-lg border overflow-hidden flex-shrink-0"
                  style={{ borderColor: 'rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.04)' }}>
                  <button onClick={() => setShowHarness(v => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
                    <Code2 size={11} style={{ color: '#4ade80' }} />
                    <span className="text-[10px] font-mono font-semibold" style={{ color: '#4ade80' }}>Backend Harness Template</span>
                    <span className="ml-auto text-[9px] font-mono" style={{ color: '#52525b' }}>{showHarness?'▲ hide':'▼ show'}</span>
                  </button>
                  {showHarness && (
                    <pre className="px-3 pb-3 text-[10px] font-mono overflow-x-auto"
                      style={{ color: '#a1a1aa', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {harnessTemplate.template}
                    </pre>
                  )}
                </div>
              )}

              {/* Test cards */}
              {generating
                ? Array.from({length:3}).map((_,i) => <SkeletonCard key={i} />)
                : tests.length === 0
                  ? <EmptyState icon={<TestTube size={28} />} heading="No test cases" action={{ label: 'Generate Now', onClick: generateForSelected }} />
                  : tests.map((tc,i) => (
                      <TestCaseCard key={tc.id} testCase={tc} index={i} subprogramId={selectedSubprogramId!}
                        onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} isDragging={draggingIdx===i} />
                    ))}
            </>
          )}
        </div>
      </div>

      {/* Right column: history */}
      <div className="w-64 flex-shrink-0 overflow-hidden">
        <TestCaseHistory />
      </div>
    </div>
  );
};

// CSV export helper
function exportAsCSV(tests: import('../../types/testcase.types').TestCase[], name: string) {
  if (tests.length===0) return;
  const inputKeys = Object.keys(tests[0].inputs);
  const header = [...inputKeys,'expected','type','coverageHint','runStatus'].join(',');
  const rows = tests.map(t => [...inputKeys.map(k => JSON.stringify(t.inputs[k]??'')), JSON.stringify(t.expected), t.type, JSON.stringify(t.coverageHint??''), t.runStatus??'pending'].join(','));
  const csv = [header,...rows].join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${name}_tests.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
