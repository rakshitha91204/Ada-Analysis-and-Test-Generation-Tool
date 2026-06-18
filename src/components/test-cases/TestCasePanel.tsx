import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useParseStore } from '../../store/useParseStore';
import { useFileStore } from '../../store/useFileStore';
import { useTestCaseStore } from '../../store/useTestCaseStore';
import { TestCaseHistory } from './TestCaseHistory';
import { EmptyState } from '../shared/EmptyState';
import { TestTube } from 'lucide-react';
import '../../styles/TestStudio.css';
import type { AdaAnalysisResult } from '../../utils/adaAnalyzer';

// ── Persistent run history helpers (6-day TTL, keyed per subprogram) ──────────
const RUN_HISTORY_MAX_DAYS = 6;

function runHistoryKey(subpName: string): string {
  return `ada_run_history__${subpName}`;
}

function readRunHistory(subpName: string): TestRunResult[] {
  try {
    const raw = localStorage.getItem(runHistoryKey(subpName));
    if (!raw) return [];
    const all = JSON.parse(raw) as TestRunResult[];
    const cutoff = Date.now() - RUN_HISTORY_MAX_DAYS * 24 * 60 * 60 * 1000;
    // Expire old entries — keep entries that have a valid date >= cutoff
    const valid = all.filter(r => {
      // timestamp may be a time-only string like "14:35:02" — treat those as today
      const d = new Date(r.savedAt ?? r.timestamp);
      if (isNaN(d.getTime())) return true; // keep if unparseable (was saved today)
      return d.getTime() >= cutoff;
    });
    return valid;
  } catch { return []; }
}

function writeRunHistory(subpName: string, history: TestRunResult[]): void {
  try {
    // Only keep last 100 entries per subprogram
    const trimmed = history.slice(0, 100);
    localStorage.setItem(runHistoryKey(subpName), JSON.stringify(trimmed));
  } catch { /* storage full — ignore */ }
}

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
  initialValue?: string; // default/declared initial value from backend
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
  savedAt?: string; // ISO date for 6-day TTL persistence
  status: 'pass'|'fail'|'error'; message: string;
  explanation?: string;
  actual: Record<string,string>; elapsed_ms: number;
  inputs_echo?: Record<string,string>; // backend echoes inputs back for display
  violations?: Array<{variable:string;type:string;value:string;error:string}>;
  normalized_types?: Record<string,string>;
  inputs: Record<string,string>; expected: Record<string,string>;
}

// ── Build StudioSubprogram from local analysis result (no extra API call) ─────
function typeConstraint(type: string): TypeConstraint {
  const raw = (type||'').trim().replace(/[''']/g, "'").replace(/\s+/g, ' ');
  const tl = raw.toLowerCase()
    // Strip package prefix ONLY for simple dotted names (no spaces): "Standard.Integer" → "integer"
    .replace(/^[a-z_]\w*\.(?=[a-z_])/i, '');

  // Handle libadalang range constraints: "Integer range 0 .. 100"
  const rangeM = /^(\w+)\s+range\s+(-?\d+)\s*\.\.\s*(-?\d+)/i.exec(tl);
  if (rangeM) {
    const base = rangeM[1], lo = parseInt(rangeM[2]), hi = parseInt(rangeM[3]);
    if (/integer|natural|positive|count|index|size/.test(base))
      return { kind: 'integer', min: lo, max: hi };
    if (/float|double/.test(base))
      return { kind: 'float', min: lo, max: hi };
  }

  // Modular types: "mod 256" or "SomeType mod 256"
  const modM = /mod\s+(\d+)/i.exec(tl);
  if (modM) return { kind: 'integer', min: 0, max: parseInt(modM[1]) - 1 };

  if (tl.includes('uint32') || tl.includes('word'))  return { kind:'integer', min:0, max:4294967295 };
  if (tl.includes('uint16'))                          return { kind:'integer', min:0, max:65535 };
  if (tl.includes('uint8')  || tl.includes('byte'))  return { kind:'integer', min:0, max:255 };
  if (tl.includes('positive'))                        return { kind:'integer', min:1, max:2147483647 };
  if (tl.includes('natural'))                         return { kind:'integer', min:0, max:2147483647 };
  if (tl.includes('long_integer'))                    return { kind:'integer', min:-2147483648, max:2147483647 };
  if (tl.includes('integer_8'))                       return { kind:'integer', min:-128, max:127 };
  if (tl.includes('integer_16'))                      return { kind:'integer', min:-32768, max:32767 };
  if (tl.includes('integer'))                         return { kind:'integer', min:-2147483648, max:2147483647 };
  if (tl.includes('long_float') || tl.includes('double')) return { kind:'float', min:-1e38, max:1e38 };
  if (tl.includes('float'))                           return { kind:'float', min:-1e38, max:1e38 };
  if (tl.includes('boolean'))                         return { kind:'boolean', values:['True','False'] };
  if (tl === 'character' || tl.startsWith('character ')) return { kind:'character' };
  if (tl.includes('string') || tl.includes('unbounded')) return { kind:'string' };
  // Common Ada index/count subtypes
  if (tl.includes('glyph_index') || tl.includes('index')) return { kind:'integer', min:0, max:2147483647 };
  if (tl.includes('count') || tl.includes('size') || tl.includes('length'))
                                                       return { kind:'integer', min:0, max:2147483647 };
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

  // Build variables from variables_info — multi-schema lookup
  // NOTE: Parameters are already in `params[]` — do NOT add them to variables
  const variables: StudioVariable[] = [];
  const fileVars = (analysis.variables_info || {})[filePath] || {};
  const seen = new Set<string>();

  // Helper: also try the basename key if filePath has a directory
  const baseKey = filePath.split(/[/\\]/).pop() ?? filePath;
  const fileVarsAlt = (analysis.variables_info || {})[baseKey] || {};
  const mergedVars = {
    parameters:       (fileVars.parameters       ?? fileVarsAlt.parameters       ?? []) as Array<{name:string;type:string;mode:string;line:number;subprogram:string}>,
    locals:           (fileVars.locals            ?? fileVarsAlt.locals            ?? []) as Array<{name:string;type:string;is_constant:boolean;line:number;subprogram:string;default?:string}>,
    globals:          (fileVars.globals           ?? fileVarsAlt.globals           ?? []) as Array<{name:string;type:string;is_constant:boolean;line:number;default?:string}>,
    global_usage:     (fileVars.global_usage      ?? fileVarsAlt.global_usage      ?? {}) as Record<string,{reads:string[];writes:string[]}>,
    local_variables:  (fileVars.local_variables   ?? fileVarsAlt.local_variables   ?? {}) as Record<string,Record<string,{type:string}>>,
    global_variables: (fileVars.global_variables  ?? fileVarsAlt.global_variables  ?? {}) as Record<string,Record<string,{type:string}>>,
    global_constants: (fileVars.global_constants  ?? fileVarsAlt.global_constants  ?? {}) as Record<string,Record<string,{type:string}>>,
  };

  // Param names — used to skip adding params into variables
  const paramNames = new Set(params.map(p => p.name.toLowerCase()));

  const addVar = (name: string, type: string, scope: 'local'|'global'|'constant', initialValue?: string) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    if (paramNames.has(key)) return; // already in params — don't duplicate
    seen.add(key);
    const t = type || 'Unknown';
    variables.push({
      name, type: t, type_normalized: t.toLowerCase(), scope,
      constraint: typeConstraint(t),
      ...(initialValue ? { initialValue } : {}),
    } as StudioVariable & { initialValue?: string });
  };

  // ── Pass 1: flat-list schema (richer — has line numbers, subprogram tag, initial values) ──
  // Skip parameters (already in params[])
  // Locals from flat list
  for (const v of mergedVars.locals) {
    const subMatch = v.subprogram === actualName || v.subprogram?.toLowerCase() === nameLower;
    if (subMatch && v.name && !paramNames.has(v.name.toLowerCase())) {
      addVar(v.name, v.type || 'Unknown', v.is_constant ? 'constant' : 'local',
             v.default != null ? String(v.default) : undefined);
    }
  }

  // Globals used by this subprogram (case-insensitive match on global_usage key)
  const usageKey = Object.keys(mergedVars.global_usage).find(
    k => k === actualName || k.toLowerCase() === nameLower
  ) ?? actualName;
  const usedGlobals = new Set<string>([
    ...(mergedVars.global_usage[usageKey]?.reads  || []).map((s: string) => s.toLowerCase()),
    ...(mergedVars.global_usage[usageKey]?.writes || []).map((s: string) => s.toLowerCase()),
  ]);
  for (const g of mergedVars.globals) {
    if (g.name && usedGlobals.has(g.name.toLowerCase())) {
      addVar(g.name, g.type || 'Unknown', g.is_constant ? 'constant' : 'global',
             g.default != null ? String(g.default) : undefined);
    }
  }

  // ── Pass 2: legacy dict schema (fallback / supplement) ──────────────────────
  // Case-insensitive lookup for legacy dicts
  const legacyKey = Object.keys(mergedVars.local_variables).find(
    k => k === actualName || k.toLowerCase() === nameLower
  ) ?? actualName;
  const legacyLocals  = mergedVars.local_variables[legacyKey]  || {};
  const legacyGlobals = mergedVars.global_variables[legacyKey] || {};
  const legacyConsts  = mergedVars.global_constants[legacyKey] || {};

  for (const [vname, vdata] of Object.entries(legacyLocals)) {
    const t = (vdata as { type: string }).type || 'Unknown';
    addVar(vname, t, 'local');
  }
  for (const [vname, vdata] of Object.entries(legacyGlobals)) {
    const t = (vdata as { type: string }).type || 'Unknown';
    addVar(vname, t, 'global');
  }
  for (const [vname, vdata] of Object.entries(legacyConsts)) {
    const t = (vdata as { type: string }).type || 'Unknown';
    addVar(vname, t, 'constant');
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

/** Smart default value for a given Ada type + param name combination */
function typeDefault(type: string, paramName = ''): string {
  const tl = (type||'').toLowerCase();
  const pl = (paramName||'').toLowerCase();
  if (tl.includes('bool'))      return 'False';
  if (tl.includes('float') || tl.includes('double')) return '0.0';
  if (tl === 'character' || tl.startsWith('character ')) return "'A'";
  if (tl.includes('string'))    return '"Hello"';
  // integers — pick a safe default
  if (tl.includes('uint32') || tl.includes('word'))  return '100';
  if (tl.includes('uint16'))                          return '100';
  if (tl.includes('uint8') || tl.includes('byte'))   return '10';
  if (tl.includes('integer_8'))                       return '0';
  if (tl.includes('integer_16'))                      return '0';
  if (tl.includes('positive'))                        return '1';
  if (tl.includes('natural'))                         return '0';
  if (tl.includes('integer'))                         return '0';
  // Ada record / composite types — infer from type name + param name
  if (tl.includes("bitmap_buffer") || tl.includes("buffer'class") || pl.includes('buffer') || pl.includes('buf'))
    return 'Buffer';
  if (tl.includes('bitmap_color'))
    return '(Red => 255, Green => 0, Blue => 0, Alpha => 255)';
  if (tl.includes('color') && !tl.includes('mode') && !tl.includes('bitmap'))
    return '(Red => 255, Green => 0, Blue => 0, Alpha => 255)';
  if (tl.includes('color_mode'))  return 'ARGB_8888';
  if (tl.includes('bmp_font') || tl.includes('hershey_font') || tl.includes('font_desc') || tl.includes('font'))
    return 'Default_Font';
  if (tl.includes('rect') || pl.includes('rect') || pl.includes('area'))
    return '(X => 0, Y => 0, Width => 10, Height => 10)';
  if (tl.includes('coord') || (tl.includes('point') && !tl.includes('pointer')))
    return '(X => 0, Y => 0)';
  if (pl === 'start' || pl === 'pos' || pl.includes('origin') || pl.includes('position'))
    return '(X => 0, Y => 0)';
  if (tl.includes('bitmap') || pl.includes('bitmap'))   return 'Buffer';
  if (tl.includes('glyph') && !tl.includes('index'))    return 'Default_Glyph';
  if (tl.includes('glyph_index') || (tl.includes('index') && !tl.includes('string')))
    return '0';
  // Name-based heuristics
  if (pl.includes('char') && !pl.includes('character')) return "'A'";
  if (pl.includes('msg') || pl.includes('str') || pl.includes('text')) return '"Hello"';
  if (pl.includes('width') || pl === 'w')   return '10';
  if (pl.includes('height') || pl === 'h')  return '10';
  if (pl.includes('row'))      return '1';
  if (pl.includes('col'))      return '1';
  if (pl === 'x' || pl.includes('x_pos'))   return '0';
  if (pl === 'y' || pl.includes('y_pos'))   return '0';
  if (pl.includes('count') || pl.includes('num') || pl.includes('len')) return '1';
  if (pl.includes('index') || pl.includes('idx'))  return '1';
  if (pl.includes('offset'))   return '0';
  if (pl.includes('size'))     return '1';
  if (pl.includes('flag') || pl.includes('enable') || pl.includes('ok') || pl.includes('bold') || pl.includes('first') || pl.includes('outline')) return 'False';
  if (pl.includes('orida') || pl.includes('aran') || pl.includes('karan')) return '0';
  if (pl.includes('foreground') || pl.includes('bg') || pl.includes('fg') || pl.includes('background'))
    return '16#FFFFFF#';
  if (pl.includes('ratio') || pl === 'scale') return '1.0';
  if (pl.includes('thickness')) return '1';
  // Unknown type: return a non-trivial default so fields don't all read "0"
  return '42';
}

function typeLabel(type: string): string {
  const tl = (type||'').toLowerCase();
  if (tl.includes('uint32') || tl.includes('word'))  return '0 .. 4294967295';
  if (tl.includes('uint16'))   return '0 .. 65535';
  if (tl.includes('uint8') || tl.includes('byte'))   return '0 .. 255';
  if (tl.includes('positive')) return '1 .. 2147483647';
  if (tl.includes('natural'))  return '0 .. 2147483647';
  if (tl.includes('integer_8'))  return '-128 .. 127';
  if (tl.includes('integer_16')) return '-32768 .. 32767';
  if (tl.includes('integer'))  return '-2147483648 .. 2147483647';
  if (tl.includes('float') || tl.includes('double')) return 'float';
  if (tl.includes('bool'))     return 'True | False';
  if (tl === 'character' || tl.startsWith('character ')) return "format: 'A'";
  if (tl.includes('string'))   return 'format: "text"';
  // Common Ada record/composite types — show format hint
  if (tl.includes('point') || tl.includes('coord')) return '(X => 0, Y => 0)';
  if (tl.includes('rect'))     return '(X => 0, Y => 0, Width => 1, Height => 1)';
  if (tl.includes('bitmap_color')) return '(Red,Green,Blue,Alpha => 0..255)';
  if (tl.includes('color_mode'))   return 'ARGB_8888 | RGB_888 | ...';
  if (tl.includes('bmp_font') || tl.includes('hershey_font') || tl.includes('font_desc') || tl.includes('font')) return 'font name / Default_Font';
  if (tl.includes('bitmap_buffer') || tl.includes("buffer'class") || tl.includes('buffer')) return 'Buffer object (in out)';
  if (tl.includes('glyph'))    return 'glyph / Default_Glyph';
  if (tl.includes('index'))    return '0 .. max';
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
  // In dev: Vite proxies /api/* → localhost:8001 automatically
  // In prod or direct access: fall back to absolute URL
  const primaryUrl = '/api' + path;
  const fallbackUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001/api') + path;

  const tryFetch = async (url: string): Promise<Response | null> => {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json') || ct.includes('text/')) return r;
      return null; // HTML response from proxy — not JSON
    } catch {
      return null;
    }
  };

  // Try proxy first
  let res = await tryFetch(primaryUrl);
  // Fall back to direct if proxy gave HTML or failed
  if (!res) res = await tryFetch(fallbackUrl);
  if (!res) return { error: 'Could not connect to backend on port 8001' } as unknown as T;
  return res.json();
}

async function studioGet<T>(path: string): Promise<T> {
  const primaryUrl = '/api' + path;
  const fallbackUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001/api') + path;

  for (const url of [primaryUrl, fallbackUrl]) {
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
  const { saveToHistory } = useTestCaseStore();
  const [studioSubp, setStudioSubp]       = useState<StudioSubprogram|null>(null);
  const [inputs,     setInputs]           = useState<Record<string,string>>({});
  const [localVars,  setLocalVars]        = useState<Record<string,string>>({});  // editable local var initial values
  const [globalVars, setGlobalVars]       = useState<Record<string,string>>({});  // editable global var initial values
  const [expected,   setExpected]         = useState<Record<string,string>>({});
  const [running,    setRunning]          = useState(false);
  const [lastResult, setLastResult]       = useState<TestRunResult|null>(null);
  // History is loaded from localStorage on mount and persisted on every run
  const [history,    setHistory]          = useState<TestRunResult[]>(() => readRunHistory(subpName));
  const [activeTab,  setActiveTab]        = useState<'inputs'|'variables'|'history'>('inputs');

  // Reload history from localStorage when subprogram changes
  useEffect(() => {
    setHistory(readRunHistory(subpName));
  }, [subpName]);

  // Build enriched subprogram — local parse store first, then API
  useEffect(() => {
    if (!subpName || !analysis) { setStudioSubp(null); return; }

    const applySubp = (found: StudioSubprogram) => {
      setStudioSubp(found);
      const inPs = found.params.filter(p => p.dir === 'in' || p.dir === 'in out');
      const outPs = found.params.filter(p => p.dir === 'out' || p.dir === 'in out');

      // Pre-fill inputs for ALL in/in-out params — including complex/unknown types
      const init: Record<string,string> = {};
      inPs.forEach(p => {
        init[p.name] = typeDefault(p.type, p.name);
      });
      setInputs(init);

      // Pre-fill local variable initial values — use backend's declared default if available
      const localInit: Record<string,string> = {};
      found.variables.filter(v => v.scope === 'local').forEach(v => {
        const backendDefault = (v as StudioVariable & { initialValue?: string }).initialValue;
        localInit[v.name] = backendDefault && backendDefault !== 'null' && backendDefault !== 'None'
          ? backendDefault
          : typeDefault(v.type, v.name);
      });
      setLocalVars(localInit);

      // Pre-fill global variable initial values (editable — user sets globals for testing)
      const globalInit: Record<string,string> = {};
      found.variables.filter(v => v.scope === 'global').forEach(v => {
        const backendDefault = (v as StudioVariable & { initialValue?: string }).initialValue;
        globalInit[v.name] = backendDefault && backendDefault !== 'null' && backendDefault !== 'None'
          ? backendDefault
          : typeDefault(v.type, v.name);
      });
      setGlobalVars(globalInit);

      // Pre-fill expected for out params (scalar types only — leave complex blank)
      const exp: Record<string,string> = {};
      outPs.forEach(p => {
        const c = typeConstraint(p.type);
        if (c.kind !== 'unknown') {
          exp[p.name] = typeDefault(p.type, p.name);
        }
        // Unknown/complex type → leave empty (no assertion forced)
      });
      setExpected(exp);
      setLastResult(null);
      // Show inputs tab if there are any in params; variables tab if only out/no params
      const hasInputs = inPs.length > 0 || found.params.length === 0;
      setActiveTab(hasInputs ? 'inputs' : 'variables');
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

    // 2. Fallback: build a minimal stub from just the subprogram name
    // so the panel always shows something rather than "no parameter info found"
    const stubSubp: StudioSubprogram = {
      name: subpName, file: '', file_name: '',
      start_line: null, end_line: null, return_type: null,
      params: [], variables: [], complexity: null, is_dead: false, calls: [],
    };

    // Try API
    studioGet<StudioSubprogram[]>('/subprograms').then(list => {
      const found = list.find(s =>
        s.name === subpName || s.name.toLowerCase() === subpName.toLowerCase()
      );
      applySubp(found ?? stubSubp);
    }).catch(() => applySubp(stubSubp));
  }, [subpName, analysis]); // eslint-disable-line

  // Persist a run result — saves to localStorage (6-day TTL) + the global store
  const persistRun = useCallback((entry: TestRunResult) => {
    const withDate: TestRunResult = { ...entry, savedAt: new Date().toISOString() };
    setHistory(prev => {
      const next = [withDate, ...prev];
      writeRunHistory(subpName, next);
      return next;
    });
    setLastResult(withDate);
    // Also save to global TestCaseStore so the right-panel "Test History" shows it
    saveToHistory({
      id: crypto.randomUUID(),
      subprogramId: subpName,
      subprogramName: subpName,
      timestamp: new Date().toISOString(),
      testCases: [{
        id: crypto.randomUUID(),
        inputs: entry.inputs as Record<string, string | number | boolean>,
        expected: Object.keys(entry.expected).length > 0
          ? JSON.stringify(entry.expected)
          : '—',
        type: 'normal',
        coverageHint: entry.message,
        runStatus: entry.status === 'pass' ? 'pass'
                 : entry.status === 'fail' ? 'fail'
                 : 'fail',
        actualOutput: JSON.stringify(entry.actual),
      }],
    });
  }, [subpName, saveToHistory]);
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
    if (c.kind === 'string') {
      const strings = ['"Hello"', '"Ada"', '"Test"', '"World"', '""'];
      if (strategy === 'edge')   return '""';
      if (strategy === 'random') return strings[Math.floor(Math.random() * strings.length)];
      return '"Hello"';
    }

    // Unknown/complex Ada types — infer from type name + parameter name
    if (tl.includes("bitmap_buffer") || tl.includes("buffer'class") || pl.includes('buffer') || pl.includes('buf'))
      return 'Buffer';
    if (tl.includes('bitmap_color'))
      return strategy === 'edge' ? '(Red => 0, Green => 0, Blue => 0, Alpha => 0)' : `(Red => ${Math.floor(Math.random()*255)}, Green => ${Math.floor(Math.random()*255)}, Blue => ${Math.floor(Math.random()*255)}, Alpha => 255)`;
    if (tl.includes('color') && !tl.includes('mode') && !tl.includes('bitmap'))
      return strategy === 'edge' ? '(Red => 0, Green => 0, Blue => 0, Alpha => 0)' : `(Red => ${Math.floor(Math.random()*255)}, Green => ${Math.floor(Math.random()*255)}, Blue => ${Math.floor(Math.random()*255)}, Alpha => 255)`;
    if (tl.includes('color_mode'))  return 'ARGB_8888';
    if (tl.includes('bmp_font') || tl.includes('hershey_font') || tl.includes('font_desc') || tl.includes('font') || pl.includes('font'))
      return 'Default_Font';
    if (tl.includes('rect') || pl.includes('rect') || pl.includes('area'))
      return strategy === 'edge' ? '(X => 0, Y => 0, Width => 0, Height => 0)' : `(X => ${Math.floor(Math.random()*100)}, Y => ${Math.floor(Math.random()*100)}, Width => ${1+Math.floor(Math.random()*100)}, Height => ${1+Math.floor(Math.random()*100)})`;
    if (tl.includes('coord') || (tl.includes('point') && !tl.includes('pointer')))
      return strategy === 'edge' ? '(X => 0, Y => 0)' : `(X => ${Math.floor(Math.random()*200)}, Y => ${Math.floor(Math.random()*200)})`;
    if (pl === 'start' || pl === 'pos' || pl.includes('origin') || pl.includes('position'))
      return strategy === 'edge' ? '(X => 0, Y => 0)' : `(X => ${Math.floor(Math.random()*200)}, Y => ${Math.floor(Math.random()*200)})`;
    if (tl.includes('bitmap') || pl.includes('bitmap'))   return 'Buffer';
    if (tl.includes('glyph') && !tl.includes('index'))    return 'Default_Glyph';
    if (tl.includes('glyph_index'))  return strategy === 'edge' ? '0' : String(Math.floor(Math.random()*100));
    if (pl.includes('msg') || pl.includes('str') || pl.includes('text'))
      return strategy === 'edge' ? '""' : '"Hello"';
    if (pl.includes('char'))     return strategy === 'edge' ? "' '" : "'A'";
    if (pl.includes('width') || pl === 'w')   return strategy === 'edge' ? '0' : String(1 + Math.floor(Math.random()*100));
    if (pl.includes('height') || pl === 'h')  return strategy === 'edge' ? '0' : String(1 + Math.floor(Math.random()*100));
    if (pl.includes('row'))   return strategy === 'edge' ? '0' : String(Math.floor(Math.random()*10));
    if (pl.includes('col'))   return strategy === 'edge' ? '0' : String(Math.floor(Math.random()*10));
    if (pl === 'x' || pl.includes('x_pos')) return strategy === 'edge' ? '0' : String(Math.floor(Math.random()*200));
    if (pl === 'y' || pl.includes('y_pos')) return strategy === 'edge' ? '0' : String(Math.floor(Math.random()*200));
    if (pl.includes('count') || pl.includes('num') || pl.includes('len')) return strategy === 'edge' ? '0' : '5';
    if (pl.includes('index') || pl.includes('idx'))  return strategy === 'edge' ? '1' : String(1 + Math.floor(Math.random()*10));
    if (pl.includes('offset'))   return strategy === 'edge' ? '0' : String(Math.floor(Math.random()*50));
    if (pl.includes('size'))     return strategy === 'edge' ? '0' : '10';
    if (pl.includes('thickness')) return strategy === 'edge' ? '1' : String(1 + Math.floor(Math.random()*5));
    if (pl.includes('ratio') || pl === 'scale') return strategy === 'edge' ? '0.0' : (Math.random()*2).toFixed(2);
    if (pl.includes('flag') || pl.includes('enable') || pl.includes('ok') || pl.includes('bold') || pl.includes('first') || pl.includes('outline'))
      return strategy === 'edge' ? 'False' : (Math.random() > 0.5 ? 'True' : 'False');
    if (pl.includes('orida') || pl.includes('aran') || pl.includes('karan'))
      return strategy === 'edge' ? '0' : String(Math.floor(Math.random()*256));
    if (pl.includes('foreground') || pl.includes('background') || pl.includes('fg') || pl.includes('bg'))
      return strategy === 'edge' ? '0' : String(Math.floor(Math.random() * 0xFFFFFF));

    // Last-resort fallback for truly unknown types — treat as a generic integer
    // and return a strategy-appropriate value rather than always 0 or 1
    if (strategy === 'edge')     return String(Math.random() > 0.5 ? 0 : 255);
    if (strategy === 'boundary') return String(Math.random() > 0.5 ? 0 : 254);
    if (strategy === 'random')   return String(Math.floor(Math.random() * 1000));
    // normal — pick a mid-range value that's actually interesting
    return String(10 + Math.floor(Math.random() * 90));
  };

  const autoGen = async () => {
    if (!studioSubp) return;

    const strategy = autoFillStrategyRef.current;
    const nextIdx = (strategyOrder.indexOf(strategy) + 1) % strategyOrder.length;
    autoFillStrategyRef.current = strategyOrder[nextIdx];

    // Build param_types for params + local variables + global variables used
    const param_types: Record<string, string> = {};
    studioSubp.params
      .filter(p => p.dir === 'in' || p.dir === 'in out')
      .forEach(p => { param_types[p.name] = p.type; });
    // Include local variables so backend can generate initial values for them too
    studioSubp.variables
      .filter(v => v.scope === 'local')
      .forEach(v => { param_types[v.name] = v.type; });
    // Include global variables used by this subprogram
    studioSubp.variables
      .filter(v => v.scope === 'global')
      .forEach(v => { param_types[v.name] = v.type; });

    try {
      // Try the backend API first — send param_types so it works without session
      const res = await studioPost<{
        values: Record<string,string>;
        strategy: string;
        note?: string;
      }>('/autofill', {
        subprogram: studioSubp.name,
        strategy,
        param_types,
      });

      if (res.values && Object.keys(res.values).length > 0) {
        // Split returned values between params, local vars, and global vars
        const newInputs: Record<string,string> = { ...inputs };
        const newLocals: Record<string,string> = { ...localVars };
        const newGlobals: Record<string,string> = { ...globalVars };
        const localNames  = new Set(studioSubp.variables.filter(v => v.scope === 'local').map(v => v.name.toLowerCase()));
        const globalNames = new Set(studioSubp.variables.filter(v => v.scope === 'global').map(v => v.name.toLowerCase()));

        for (const [k, v] of Object.entries(res.values)) {
          if (localNames.has(k.toLowerCase())) {
            newLocals[k] = v;
          } else if (globalNames.has(k.toLowerCase())) {
            newGlobals[k] = v;
          } else {
            newInputs[k] = v;
          }
        }
        setInputs(newInputs);
        setLocalVars(newLocals);
        setGlobalVars(newGlobals);
        return;
      }
    } catch {
      // Fall through to local
    }

    // Local fallback — fill params with smartDefault
    const next: Record<string,string> = {};
    studioSubp.params
      .filter(p => p.dir === 'in' || p.dir === 'in out')
      .forEach(p => {
        next[p.name] = smartDefault(p.name, p.type, p.constraint, strategy);
      });
    setInputs(next);

    // Also fill local variables with smartDefault
    const nextLocals: Record<string,string> = {};
    studioSubp.variables
      .filter(v => v.scope === 'local')
      .forEach(v => {
        nextLocals[v.name] = smartDefault(v.name, v.type, typeConstraint(v.type), strategy);
      });
    setLocalVars(nextLocals);

    // Also fill global variables used by this subprogram
    const nextGlobals: Record<string,string> = {};
    studioSubp.variables
      .filter(v => v.scope === 'global')
      .forEach(v => {
        nextGlobals[v.name] = smartDefault(v.name, v.type, typeConstraint(v.type), strategy);
      });
    setGlobalVars(nextGlobals);
  };

  // Auto-generate test cases for ALL params, even unknown types — called on first load
  const generateInitialInputs = useCallback((subp: StudioSubprogram) => {
    const inPs = subp.params.filter(p => p.dir === 'in' || p.dir === 'in out');
    if (inPs.length === 0) return;
    const next: Record<string,string> = {};
    inPs.forEach(p => { next[p.name] = typeDefault(p.type, p.name); });
    setInputs(next);
  }, []);

  const runTest = async () => {
    if (!studioSubp) return;
    setRunning(true);

    // Build param_types for ALL params + local variables + global variables
    const param_types: Record<string, string> = {};
    studioSubp.params.forEach(p => {
      param_types[p.name] = p.type;
    });
    // Include local variables in param_types so backend validates them too
    studioSubp.variables.filter(v => v.scope === 'local').forEach(v => {
      param_types[v.name] = v.type;
    });
    // Include global variables used by this subprogram
    studioSubp.variables.filter(v => v.scope === 'global').forEach(v => {
      param_types[v.name] = v.type;
    });

    // Merge param inputs + local var initial values + global var values into one dict
    const allInputs: Record<string,string> = {
      ...inputs,
      ...localVars,   // local variable initial values
      ...globalVars,  // global variable initial values
    };

    // Client-side pre-validation for known types (immediate feedback)
    // Validates both params AND local variable initial values
    const clientViolations: Array<{variable: string; type: string; value: string; error: string}> = [];

    // Validate param inputs
    studioSubp.params
      .filter(p => p.dir === 'in' || p.dir === 'in out')
      .forEach(p => {
        const val = allInputs[p.name] ?? '';
        const c = p.constraint;
        if (c.kind === 'integer') {
          const n = Number(val);
          if (!val || isNaN(n) || !Number.isInteger(n)) {
            clientViolations.push({ variable: p.name, type: p.type, value: val, error: `Expected integer, got '${val}'` });
          } else if (c.min !== undefined && n < c.min) {
            clientViolations.push({ variable: p.name, type: p.type, value: val, error: `Value ${n} out of range [${c.min} .. ${c.max}]` });
          } else if (c.max !== undefined && n > c.max) {
            clientViolations.push({ variable: p.name, type: p.type, value: val, error: `Value ${n} out of range [${c.min} .. ${c.max}]` });
          }
        } else if (c.kind === 'float') {
          if (val && isNaN(Number(val))) {
            clientViolations.push({ variable: p.name, type: p.type, value: val, error: `Expected float, got '${val}'` });
          }
        } else if (c.kind === 'boolean') {
          if (val && val !== 'True' && val !== 'False') {
            clientViolations.push({ variable: p.name, type: p.type, value: val, error: `Expected True or False, got '${val}'` });
          }
        } else if (c.kind === 'character') {
          if (val && !(val.startsWith("'") && val.endsWith("'") && val.length === 3)) {
            clientViolations.push({ variable: p.name, type: p.type, value: val, error: `Expected character literal like 'A', got '${val}'` });
          }
        }
      });

    // Validate local variable initial values (scalar types only)
    studioSubp.variables.filter(v => v.scope === 'local').forEach(v => {
      const val = localVars[v.name] ?? '';
      if (!val) return; // blank is fine — backend uses default
      const c = v.constraint;
      if (c.kind === 'integer') {
        const n = Number(val);
        if (isNaN(n) || !Number.isInteger(n)) {
          clientViolations.push({ variable: v.name, type: v.type, value: val, error: `Local var: expected integer, got '${val}'` });
        } else if (c.min !== undefined && n < c.min) {
          clientViolations.push({ variable: v.name, type: v.type, value: val, error: `Local var: ${n} out of range [${c.min} .. ${c.max}]` });
        } else if (c.max !== undefined && n > c.max) {
          clientViolations.push({ variable: v.name, type: v.type, value: val, error: `Local var: ${n} out of range [${c.min} .. ${c.max}]` });
        }
      }
    });

    // If client-side violations found, show error immediately without hitting backend
    if (clientViolations.length > 0) {
      const details = clientViolations.map(v => `${v.variable}: ${v.error}`).join('; ');
      const entry: TestRunResult = {
        subprogram: studioSubp.name,
        timestamp: new Date().toLocaleTimeString(),
        status: 'error',
        message: `Type constraint violation — ${details}`,
        explanation: `The test could not run because ${clientViolations.length} input(s) failed Ada type validation: ${details}. Fix the input values to match the declared Ada types.`,
        actual: {},
        elapsed_ms: 0,
        violations: clientViolations,
        inputs: allInputs,
        expected,
      };
      persistRun(entry);
      setRunning(false);
      return;
    }

    try {
      const res = await studioPost<TestRunResult & { error?: string }>('/test/run', {
        subprogram: studioSubp.name,
        inputs: allInputs,      // params + local var initial values
        expected,
        param_types,            // type info for all params + locals
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
          inputs: allInputs,
          expected,
        };
        persistRun(entry);
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
        inputs: allInputs,
        expected,
      };
      persistRun(entry);
    } catch (e) {
      const entry: TestRunResult = {
        subprogram: studioSubp.name,
        timestamp: new Date().toLocaleTimeString(),
        status: 'error',
        message: 'Network error',
        explanation: `Could not reach backend: ${(e as Error).message}. Make sure the backend is running on port 8001.`,
        actual: {},
        elapsed_ms: 0,
        inputs: allInputs,
        expected,
      };
      persistRun(entry);
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
  // A subprogram "has no params" only when truly no parameters exist at all
  // (procedures with only 'out' params still have params — just no user inputs needed)
  const hasNoParams = studioSubp.params.length === 0;

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
            // No declared parameters — but may have local/global variables that act as initial state
            studioSubp.variables.filter(v => v.scope === 'local' || v.scope === 'global').length > 0 ? (
              <>
                <div style={{ padding: '4px 0 10px', fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>⚡</span>
                  <span>
                    <strong style={{ color: '#a1a1aa' }}>{studioSubp.name}</strong> has no declared parameters.
                    Set initial values for its variables below.
                  </span>
                </div>

                {/* Local variables as editable inputs */}
                {studioSubp.variables.filter(v => v.scope === 'local').length > 0 && <>
                  <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#a5b4fc' }}>
                    local variables — set initial values for test
                    <span style={{ fontSize: 9, color: '#52525b', marginLeft: 8 }}>(initial state before procedure runs)</span>
                  </div>
                  <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                    {studioSubp.variables.filter(v => v.scope === 'local').map((v, i) => (
                      <div key={i} className="ts-input-card"
                        style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                        <div className="ts-input-header">
                          <span className="ts-input-dir" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 9 }}>local</span>
                          <span className="ts-input-name">{v.name}</span>
                        </div>
                        <div className="ts-input-type ts-mono">{v.type} <CaseBadge type={v.type} /></div>
                        {typeLabel(v.type) && <div className="ts-input-range">{typeLabel(v.type)}</div>}
                        {v.constraint.kind === 'boolean'
                          ? <select className="ts-input-field"
                              value={localVars[v.name] ?? typeDefault(v.type, v.name)}
                              onChange={e => setLocalVars(lv => ({ ...lv, [v.name]: e.target.value }))}>
                              <option>False</option><option>True</option>
                            </select>
                          : <input className="ts-input-field"
                              type={v.constraint.kind === 'integer' ? 'number' : 'text'}
                              value={localVars[v.name] ?? typeDefault(v.type, v.name)}
                              onChange={e => setLocalVars(lv => ({ ...lv, [v.name]: e.target.value }))}
                              placeholder={typeDefault(v.type, v.name)}
                              min={v.constraint.min} max={v.constraint.max} />}
                      </div>
                    ))}
                  </div>
                </>}

                {/* Global variables as editable inputs */}
                {studioSubp.variables.filter(v => v.scope === 'global').length > 0 && <>
                  <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#fbbf24' }}>
                    global variables — set initial values for test
                  </div>
                  <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                    {studioSubp.variables.filter(v => v.scope === 'global').map((v, i) => (
                      <div key={i} className="ts-input-card"
                        style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.03)' }}>
                        <div className="ts-input-header">
                          <span className="ts-input-dir" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: 9 }}>global</span>
                          <span className="ts-input-name">{v.name}</span>
                        </div>
                        <div className="ts-input-type ts-mono">{v.type} <CaseBadge type={v.type} /></div>
                        {typeLabel(v.type) && <div className="ts-input-range">{typeLabel(v.type)}</div>}
                        {v.constraint.kind === 'boolean'
                          ? <select className="ts-input-field"
                              value={globalVars[v.name] ?? typeDefault(v.type, v.name)}
                              onChange={e => setGlobalVars(gv => ({ ...gv, [v.name]: e.target.value }))}>
                              <option>False</option><option>True</option>
                            </select>
                          : <input className="ts-input-field"
                              type={v.constraint.kind === 'integer' ? 'number' : 'text'}
                              value={globalVars[v.name] ?? typeDefault(v.type, v.name)}
                              onChange={e => setGlobalVars(gv => ({ ...gv, [v.name]: e.target.value }))}
                              placeholder={typeDefault(v.type, v.name)}
                              min={v.constraint.min} max={v.constraint.max} />}
                      </div>
                    ))}
                  </div>
                </>}
              </>
            ) : (
              <div style={{ padding: '8px 0 12px', fontSize: 12, color: '#71717a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚡</span>
                <span>
                  <strong style={{ color: '#a1a1aa' }}>{studioSubp.name}</strong> has no parameters or variables.
                  This is a parameterless procedure — click Run Test to execute it.
                </span>
              </div>
            )
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
                            value={inputs[p.name]??typeDefault(p.type, p.name)}
                            onChange={e => setInputs(i => ({...i,[p.name]:e.target.value}))}
                            placeholder={p.constraint.kind==='character' ? "'A'" : p.constraint.kind==='string' ? '"text"' : p.constraint.kind==='unknown' ? typeDefault(p.type, p.name) : undefined}
                            min={p.constraint.min} max={p.constraint.max} />}
                    </div>
                  ))}
                </div>
              </>}

              {/* OUT PARAMETERS */}
              {outParams.length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px' }}>
                  expected output values
                  <span style={{ fontSize: 9, color: '#52525b', marginLeft: 8 }}>
                    (leave blank for complex types — no assertion will be made)
                  </span>
                </div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {outParams.map(p => {
                    const isComplex = p.constraint.kind === 'unknown';
                    return (
                    <div key={p.name} className="ts-input-card ts-input-card-out"
                      style={isComplex ? { opacity: 0.75, borderColor: 'rgba(113,113,122,0.3)' } : {}}>
                      <div className="ts-input-header">
                        <span className="ts-input-dir out">out</span>
                        <span className="ts-input-name">{p.name}</span>
                        {isComplex && (
                          <span style={{ fontSize: 9, color: '#52525b', marginLeft: 4, fontStyle: 'italic' }}>optional</span>
                        )}
                      </div>
                      <div className="ts-input-type ts-mono">{p.type} <CaseBadge type={p.type} /></div>
                      {typeLabel(p.type) && <div className="ts-input-range">{typeLabel(p.type)}</div>}
                      {isComplex && (
                        <div style={{ fontSize: 9, color: '#52525b', marginBottom: 4, fontStyle: 'italic' }}>
                          Complex type — leave blank or enter expected value manually
                        </div>
                      )}
                      <input className="ts-input-field" type="text"
                        value={expected[p.name] ?? ''}
                        onChange={e => setExpected(ex => ({...ex,[p.name]:e.target.value}))}
                        placeholder={isComplex ? 'leave blank (no assertion) or type expected' : 'expected value'}
                      />
                    </div>
                    );
                  })}
                </div>
              </>}

              {/* LOCAL VARIABLES — editable initial values for testing */}
              {studioSubp.variables.filter(v => v.scope === 'local').length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#a5b4fc' }}>
                  local variables — set initial values for test
                  <span style={{ fontSize: 9, color: '#52525b', marginLeft: 8 }}>
                    (initial state before procedure runs)
                  </span>
                </div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {studioSubp.variables.filter(v => v.scope === 'local').map((v, i) => (
                    <div key={i} className="ts-input-card"
                      style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                      <div className="ts-input-header">
                        <span className="ts-input-dir" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 9 }}>local</span>
                        <span className="ts-input-name">{v.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">{v.type} <CaseBadge type={v.type} /></div>
                      {typeLabel(v.type) && <div className="ts-input-range">{typeLabel(v.type)}</div>}
                      {/* Editable — user sets the initial value for this local variable */}
                      {v.constraint.kind === 'boolean'
                        ? <select className="ts-input-field"
                            value={localVars[v.name] ?? typeDefault(v.type, v.name)}
                            onChange={e => setLocalVars(lv => ({ ...lv, [v.name]: e.target.value }))}>
                            <option>False</option><option>True</option>
                          </select>
                        : <input className="ts-input-field"
                            type={v.constraint.kind === 'integer' ? 'number' : 'text'}
                            value={localVars[v.name] ?? typeDefault(v.type, v.name)}
                            onChange={e => setLocalVars(lv => ({ ...lv, [v.name]: e.target.value }))}
                            placeholder={typeDefault(v.type, v.name)}
                            title={`Initial value for local variable ${v.name} : ${v.type}`}
                            min={v.constraint.min} max={v.constraint.max} />}
                    </div>
                  ))}
                </div>
              </>}

              {/* CONSTANTS — shown read-only with their declared value */}
              {studioSubp.variables.filter(v => v.scope === 'constant').length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#52525b' }}>
                  constants — declared values (read-only)
                </div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {studioSubp.variables.filter(v => v.scope === 'constant').map((v, i) => {
                    const declaredVal = (v as StudioVariable & { initialValue?: string }).initialValue;
                    const displayVal = declaredVal && declaredVal !== 'null' && declaredVal !== 'None'
                      ? declaredVal : typeDefault(v.type, v.name);
                    return (
                    <div key={i} className="ts-input-card" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                      <div className="ts-input-header">
                        <span className="ts-input-dir" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 9 }}>const</span>
                        <span className="ts-input-name">{v.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">{v.type} <CaseBadge type={v.type} /></div>
                      <input className="ts-input-field ts-mono"
                        value={displayVal}
                        readOnly
                        style={{ opacity: 0.7, cursor: 'default', borderColor: 'rgba(245,158,11,0.3)' }}
                        title={`Constant — declared value: ${displayVal}`} />
                    </div>
                    );
                  })}
                </div>
              </>}

              {/* GLOBAL VARIABLES — editable initial values for globals used by this subprogram */}
              {studioSubp.variables.filter(v => v.scope === 'global').length > 0 && <>
                <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#fbbf24' }}>
                  global variables — set initial values for test
                  <span style={{ fontSize: 9, color: '#52525b', marginLeft: 8 }}>
                    (globals read/written by this subprogram)
                  </span>
                </div>
                <div className="ts-input-grid" style={{ marginBottom: 12 }}>
                  {studioSubp.variables.filter(v => v.scope === 'global').map((v, i) => (
                    <div key={i} className="ts-input-card"
                      style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.03)' }}>
                      <div className="ts-input-header">
                        <span className="ts-input-dir" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: 9 }}>global</span>
                        <span className="ts-input-name">{v.name}</span>
                      </div>
                      <div className="ts-input-type ts-mono">{v.type} <CaseBadge type={v.type} /></div>
                      {typeLabel(v.type) && <div className="ts-input-range">{typeLabel(v.type)}</div>}
                      {v.constraint.kind === 'boolean'
                        ? <select className="ts-input-field"
                            value={globalVars[v.name] ?? typeDefault(v.type, v.name)}
                            onChange={e => setGlobalVars(gv => ({ ...gv, [v.name]: e.target.value }))}>
                            <option>False</option><option>True</option>
                          </select>
                        : <input className="ts-input-field"
                            type={v.constraint.kind === 'integer' ? 'number' : 'text'}
                            value={globalVars[v.name] ?? typeDefault(v.type, v.name)}
                            onChange={e => setGlobalVars(gv => ({ ...gv, [v.name]: e.target.value }))}
                            placeholder={typeDefault(v.type, v.name)}
                            title={`Initial value for global variable ${v.name} : ${v.type}`}
                            min={v.constraint.min} max={v.constraint.max} />}
                    </div>
                  ))}
                </div>
              </>}
            </>
          )}

          {/* Buttons — always show Run Test; show auto-fill and export when there are any inputs */}
          <div className="ts-btn-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <button className="ts-btn ts-btn-primary" onClick={runTest} disabled={running}>
              ▶ {running ? 'running...' : 'run test'}
            </button>
            {/* Show auto-fill if there are params OR local/global variables */}
            {(inParams.length > 0 || studioSubp.variables.filter(v => v.scope === 'local' || v.scope === 'global').length > 0) && (
              <button className="ts-btn" onClick={autoGen}>
                ✨ auto-fill <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 2 }}>({autoFillStrategyRef.current})</span>
              </button>
            )}
            {(inParams.length > 0 || studioSubp.variables.filter(v => v.scope === 'local' || v.scope === 'global').length > 0) && (
              <button className="ts-btn" onClick={() => {
                const exportData = {
                  subprogram: studioSubp.name,
                  parameters: inputs,
                  local_variables: localVars,
                  global_variables: globalVars,
                  expected_outputs: expected,
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {type:'application/json'});
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `${studioSubp.name}_inputs.json`; a.click();
              }}>⬇ export inputs</button>
            )}
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
                    ? `✓ Test passed. Subprogram "${studioSubp.name}" executed successfully. All output assertions matched.`
                    : lastResult.status === 'fail'
                    ? (() => {
                        // Check if the failure is due to a complex output type
                        const complexOuts = outParams.filter(p => p.constraint.kind === 'unknown');
                        if (complexOuts.length > 0 && Object.keys(lastResult.actual || {}).length > 0) {
                          return `ℹ Note: Output parameter(s) ${complexOuts.map(p=>p.name).join(', ')} have complex Ada types (${complexOuts.map(p=>p.type).join(', ')}). The backend simulation uses integer arithmetic — results for non-integer types are not meaningful. Leave those expected fields blank to skip the assertion, or run the actual Ada program for correct output.`;
                        }
                        return `✗ Test failed. Check your expected output values against the actual results below.`;
                      })()
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

              {/* Execution summary — always shown after a run */}
              {lastResult.status !== 'error' && (
                <div className="ts-result-table ts-mono" style={{ marginTop: 6 }}>
                  {/* Input values */}
                  {Object.entries(lastResult.inputs || {}).map(([k, v]) => (
                    <div key={`in_${k}`} className="ts-result-row">
                      <span style={{ minWidth: 80, color: '#93c5fd' }}>{k}</span>
                      <span style={{ fontSize: 10, color: '#6b7280', marginRight: 6 }}>in</span>
                      <span className="ts-result-actual ok" style={{ marginLeft: 'auto' }}>
                        {v}
                      </span>
                    </div>
                  ))}
                  {/* Separator between inputs and outputs when both exist */}
                  {Object.keys(lastResult.inputs || {}).length > 0 &&
                   Object.keys(lastResult.actual || {}).length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '4px 0' }} />
                  )}
                  {/* Output values vs expected */}
                  {Object.entries(lastResult.actual || {}).map(([k, v]) => (
                    <div key={`out_${k}`} className="ts-result-row">
                      <span style={{ minWidth: 80, color: '#fb923c' }}>{k}</span>
                      <span className="ts-result-expected">expected: {lastResult.expected?.[k] ?? '—'}</span>
                      <span className={`ts-result-actual ${v === (lastResult.expected?.[k]) ? 'ok' : 'bad'}`}>
                        actual: {v}
                      </span>
                    </div>
                  ))}
                  {/* When no outputs: show a note */}
                  {Object.keys(lastResult.actual || {}).length === 0 && (
                    <div className="ts-result-row" style={{ color: '#52525b', fontSize: 10 }}>
                      <span>no output parameters</span>
                    </div>
                  )}
                </div>
              )}

              {/* Violation details (error state) */}
              {lastResult.status === 'error' &&
               (lastResult.violations?.length ?? 0) === 0 && (
                <div style={{ fontSize: 10, color: '#71717a', marginTop: 4, fontFamily: 'monospace' }}>
                  Check backend connection and that the file has been uploaded and parsed.
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
            all variables — type, scope, constraint, initial value
          </div>

          {/* Summary counts */}
          {studioSubp.variables.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['local','global','constant'] as const).map(scope => {
                const count = studioSubp.variables.filter(v => v.scope === scope).length;
                if (count === 0) return null;
                const colors: Record<string,string> = { local:'#a5b4fc', global:'#fbbf24', constant:'#f59e0b' };
                return (
                  <span key={scope} style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
                    background: `rgba(${scope==='local'?'99,102,241':scope==='global'?'251,191,36':'245,158,11'},0.12)`,
                    color: colors[scope], border: `1px solid rgba(${scope==='local'?'99,102,241':scope==='global'?'251,191,36':'245,158,11'},0.3)` }}>
                    {count} {scope}
                  </span>
                );
              })}
              <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4,
                background: 'rgba(255,255,255,0.05)', color: '#71717a', border: '1px solid rgba(255,255,255,0.08)' }}>
                {studioSubp.variables.length} total
              </span>
            </div>
          )}

          {studioSubp.variables.length === 0
            ? <div style={{ fontSize: 12, color: '#71717a', padding: '8px 0' }}>
                no variables extracted — analyse the file first with the ⬛ button
              </div>
            : <table className="ts-vars-table">
                <thead>
                  <tr>
                    <th>name</th><th>declared type</th><th>scope</th><th>constraint</th><th>initial</th>
                  </tr>
                </thead>
                <tbody>
                  {studioSubp.variables.map((v, i) => {
                    const iv = (v as StudioVariable & { initialValue?: string }).initialValue;
                    const displayInit = iv && iv !== 'null' && iv !== 'None'
                      ? iv : typeDefault(v.type, v.name);
                    const scopeColors: Record<string, string> = {
                      local: '#a5b4fc', global: '#fbbf24', constant: '#f59e0b'
                    };
                    return (
                    <tr key={i}>
                      <td className="ts-mono" style={{ fontWeight: 600 }}>{v.name}</td>
                      <td className="ts-mono" style={{ color: '#fb923c' }}>
                        {v.type} <CaseBadge type={v.type} />
                      </td>
                      <td>
                        <span className={`ts-scope-pill ts-scope-${v.scope}`}
                          style={{ color: scopeColors[v.scope] }}>
                          {v.scope}
                        </span>
                      </td>
                      <td className="ts-mono" style={{ fontSize: 10, color: '#71717a' }}>
                        {v.constraint.kind === 'integer'
                          ? `${v.constraint.min} .. ${v.constraint.max}`
                          : v.constraint.kind === 'float'
                          ? 'float'
                          : v.constraint.kind === 'boolean'
                          ? 'True | False'
                          : v.constraint.kind === 'character'
                          ? "format: 'A'"
                          : v.constraint.kind === 'string'
                          ? 'format: "text"'
                          : typeLabel(v.type) || v.type.split(/\s+/)[0] || 'record/composite'}
                      </td>
                      <td className="ts-mono" style={{ fontSize: 10, color: '#4ade80' }}>
                        {displayInit}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>}

          {/* Params summary */}
          {studioSubp.params.length > 0 && (
            <>
              <div className="ts-section-label" style={{ padding: '12px 0 8px' }}>
                parameters ({studioSubp.params.length})
              </div>
              <table className="ts-vars-table">
                <thead>
                  <tr>
                    <th>name</th><th>type</th><th>mode</th><th>constraint</th>
                  </tr>
                </thead>
                <tbody>
                  {studioSubp.params.map((p, i) => (
                    <tr key={i}>
                      <td className="ts-mono" style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="ts-mono" style={{ color: '#fb923c' }}>{p.type}</td>
                      <td>
                        <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 3,
                          background: p.dir === 'in' ? 'rgba(96,165,250,0.15)' : p.dir === 'out' ? 'rgba(74,222,128,0.15)' : 'rgba(192,132,252,0.15)',
                          color: p.dir === 'in' ? '#60a5fa' : p.dir === 'out' ? '#4ade80' : '#c084fc' }}>
                          {p.dir}
                        </span>
                      </td>
                      <td className="ts-mono" style={{ fontSize: 10, color: '#71717a' }}>
                        {p.constraint.kind === 'integer'
                          ? `${p.constraint.min} .. ${p.constraint.max}`
                          : p.constraint.kind === 'float'
                          ? 'float'
                          : p.constraint.kind === 'boolean'
                          ? 'True | False'
                          : p.constraint.kind === 'character'
                          ? "format: 'A'"
                          : p.constraint.kind === 'string'
                          ? 'format: "text"'
                          : typeLabel(p.type) || p.type.split(/\s+/)[0] || 'record/composite'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div style={{ padding: '12px 14px' }}>
          <div className="ts-section-label" style={{ padding: '0 0 8px', color: '#71717a' }}>
            test run history for {studioSubp.name}
            {history.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 9, color: '#52525b' }}>
                · persists {RUN_HISTORY_MAX_DAYS} days · {history.length} run{history.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {history.length === 0
            ? <div style={{ fontSize: 12, color: '#71717a', padding: '8px 0' }}>no tests run yet — run a test above to record history</div>
            : history.map((r,i) => {
                // Format the saved date nicely
                const dateStr = (() => {
                  try {
                    const d = new Date(r.savedAt ?? r.timestamp);
                    if (isNaN(d.getTime())) return r.timestamp;
                    const now = new Date();
                    const isToday = d.toDateString() === now.toDateString();
                    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  } catch { return r.timestamp; }
                })();
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0',
                    borderBottom:'0.5px solid rgba(255,255,255,0.06)', fontSize:11 }}>
                    <StatusDot status={r.status} />
                    <span style={{ color:'#71717a', minWidth:72, fontSize: 10 }}>{dateStr}</span>
                    <span style={{ fontWeight:600, fontSize: 11, color: r.status==='pass'?'#4ade80':r.status==='fail'?'#f87171':'#fbbf24', minWidth: 38 }}>
                      {r.status.toUpperCase()}
                    </span>
                    <span className="ts-mono" style={{ fontSize:10, color:'#52525b', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {Object.entries(r.inputs).map(([k,v]) => `${k}=${v}`).join(', ') || '(no inputs)'}
                    </span>
                  </div>
                );
              })}
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
  const { selectedSubprogramId, selectSubprogram } = useSubprogramStore();

  const { results, activeResultFileId } = useParseStore();
  const { activeFileId } = useFileStore();

  // Show only subprograms for the CURRENTLY ACTIVE file.
  // When the user clicks a file, only that file's subprograms appear.
  // Clicking another file replaces them with the new file's subprograms.
  const activeResult = (() => {
    if (activeResultFileId && results[activeResultFileId]) return results[activeResultFileId];
    if (activeFileId && results[activeFileId]) return results[activeFileId];
    const vals = Object.values(results);
    return vals.length > 0 ? vals[vals.length - 1] : null;
  })();

  // Subprograms come from the active file's parse result — NOT the whole store
  // so previous files' subprograms never mix in
  const parseStoreSubprograms = activeResult?.subprograms ?? [];

  // Subprograms come ONLY from the active file's parse result.
  // We never fall back to storeSubprograms here because the store
  // may still hold a previous file's subprograms until the next
  // setSubprograms call fires. Using activeResult directly ensures
  // the list always matches exactly what the user clicked.
  const subprograms = parseStoreSubprograms;

  // Auto-clear selected subprogram when switching files
  // (when the selected ID no longer exists in the current file's subprograms)
  useEffect(() => {
    if (selectedSubprogramId && parseStoreSubprograms.length > 0) {
      const stillPresent = parseStoreSubprograms.some(s => s.id === selectedSubprogramId);
      if (!stillPresent) selectSubprogram(null);
    }
  }, [parseStoreSubprograms, selectedSubprogramId, selectSubprogram]);

  const selectedSub = subprograms.find(s => s.id === selectedSubprogramId);

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
  const activeAnalysisResult = (() => {
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
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {!selectedSubprogramId ? (
            <EmptyState icon={<TestTube size={28} />} heading="Select a subprogram" subtext="Select a subprogram to run tests." />
          ) : (
            <>
              {/* ── TEST STUDIO INPUTS — shown at top when subprogram selected ── */}
              <TestStudioInputs subpName={resolvedSubpName} analysis={activeAnalysisResult?.analysis ?? null} />
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
