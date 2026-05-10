/**
 * Ada source analyzer — produces JSON matching the backend schema exactly.
 *
 * Backend schema (from analysis_output.json / output.json):
 * {
 *   file_paths: string[],
 *   subprogram_index: { [filePath]: SubprogramEntry[] },
 *   call_graph: { [subName]: string[] },
 *   global_read_write: { [filePath]: { read: string[], write: string[] } },
 *   cyclomatic_complexity: { [subName]: number },
 *   dead_code: string[],
 *   variables_info: {
 *     [filePath]: {
 *       global_variables: { [subName]: { [varName]: { type: string } } },
 *       global_constants: { [subName]: { [varName]: { type: string } } },
 *       local_variables:  { [subName]: { [varName]: { type: string } } }
 *     }
 *   },
 *   control_flow_extractor: {
 *     [filePath]: {
 *       [subName]: {
 *         if_conditions: IfCondition[],
 *         branch_body_variables: { [varName]: BranchVar },
 *         procedure_calls: string[]
 *       }
 *     }
 *   }
 * }
 */

import { parseSubprograms } from './adaParser';
import { Subprogram } from '../types/subprogram.types';

// ── Types matching backend schema ─────────────────────────────────────────────

export interface SubprogramEntry {
  name: string;
  parameters: string[];
  return_type: string | null;
  start_line: number;
  end_line: number;
}

export interface IfCondition {
  condition_text: string;
  branch_type: 'if' | 'elsif' | 'else' | 'when';
  nesting_depth: number;
  variables: Record<string, { kind: string; data_type: { type: string } }>;
}

export interface BranchVar {
  kind: string;
  data_type: { type: string };
  used_in_branch: string;
  assigned_from?: string;
}

export interface ControlFlowEntry {
  if_conditions: IfCondition[];
  branch_body_variables: Record<string, BranchVar>;
  procedure_calls: string[];
}

export interface VariablesForFile {
  global_variables: Record<string, Record<string, { type: string }>>;
  global_constants: Record<string, Record<string, { type: string }>>;
  local_variables: Record<string, Record<string, { type: string }>>;
}

// ── New fields from fully-connected backend ───────────────────────────────────

export interface BugEntry {
  file: string;
  line: number;
  expression?: string;
  subprogram?: string;
  statement?: string;
  note?: string;
}

export interface BugReport {
  division_by_zero: BugEntry[];
  uninitialized_variables: BugEntry[];
  null_dereference: BugEntry[];
  infinite_loops: BugEntry[];
  unreachable_code: BugEntry[];
}

export interface HarnessEntry {
  test_name: string;
  original_subprogram: string;
  is_function: boolean;
  return_type: string | null;
  parameters: string[];
  template: string;
}

export interface AdaAnalysisResult {
  file_paths: string[];
  // AST root kind per file (from Parser)
  ast_info?: Record<string, string>;
  subprogram_index: Record<string, SubprogramEntry[]>;
  call_graph: Record<string, string[]>;
  global_read_write: Record<string, { read: string[]; write: string[] }>;
  cyclomatic_complexity: Record<string, number>;
  dead_code: string[];
  variables_info: Record<string, VariablesForFile>;
  control_flow_extractor: Record<string, Record<string, ControlFlowEntry>>;
  loop_info?: Record<string, number>;
  exceptions_info?: Record<string, number>;
  concurrency_info?: { tasks: string[]; protected_objects: string[] };
  // Protected objects from ProtectedAccessDetector
  protected_objects?: string[];
  logical_errors?: string[];
  // Full bug report from BugDetector
  bug_report?: BugReport;
  performance_warnings?: string[];
  test_harness_data?: Record<string, HarnessEntry[]>;
  mock_stub_data?: Record<string, string>;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export function analyzeAdaSource(
  content: string,
  fileName: string,
  _fileType: 'spec' | 'body'
): AdaAnalysisResult {
  const lines = content.split('\n');
  const fileId = fileName.replace(/\W/g, '_');
  const subprograms = parseSubprograms(content, fileId);
  const filePath = fileName; // use filename as path key (matches backend)

  const subprogramIndex = buildSubprogramIndex(subprograms);
  const callGraph = buildCallGraph(lines, subprograms);
  const globalRW = buildGlobalReadWrite(lines, subprograms, filePath);
  const complexity = buildCyclomaticComplexity(lines, subprograms);
  const deadCode = detectDeadCode(lines, subprograms);
  const variablesInfo = buildVariablesInfo(lines, subprograms);
  const controlFlow = buildControlFlow(lines, subprograms);

  return {
    file_paths: [filePath],
    ast_info: { [filePath]: 'CompilationUnit' },
    subprogram_index: { [filePath]: subprogramIndex },
    call_graph: callGraph,
    global_read_write: { [filePath]: globalRW },
    cyclomatic_complexity: complexity,
    dead_code: deadCode,
    variables_info: { [filePath]: variablesInfo },
    control_flow_extractor: { [filePath]: controlFlow },
    loop_info: {},
    exceptions_info: {},
    concurrency_info: { tasks: [], protected_objects: [] },
    protected_objects: [],
    logical_errors: [],
    bug_report: {
      division_by_zero: [],
      uninitialized_variables: [],
      null_dereference: [],
      infinite_loops: [],
      unreachable_code: [],
    },
    performance_warnings: [],
    test_harness_data: {},
    mock_stub_data: {},
  };
}

// ── Subprogram index ──────────────────────────────────────────────────────────

function buildSubprogramIndex(subprograms: Subprogram[]): SubprogramEntry[] {
  return subprograms.map((s) => ({
    name: s.name,
    parameters: s.parameters.map((p) => `${p.name} : ${p.mode} ${p.paramType}`),
    return_type: s.returnType ?? null,
    start_line: s.startLine,
    end_line: s.endLine,
  }));
}

// ── Call graph ────────────────────────────────────────────────────────────────

function buildCallGraph(lines: string[], subprograms: Subprogram[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const subNames = subprograms.map((s) => s.name);

  subprograms.forEach((caller) => {
    const callees: string[] = [];
    const seen = new Set<string>();

    for (let i = caller.startLine; i <= caller.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;

      subNames.forEach((callee) => {
        if (callee.toLowerCase() === caller.name.toLowerCase()) return;
        const re = new RegExp(`\\b${callee}\\s*[\\(;,\\s]`, 'i');
        if (re.test(line) && !seen.has(callee)) {
          seen.add(callee);
          callees.push(callee);
        }
      });

      // Also capture any identifier followed by ( that isn't a keyword
      const callRe = /\b([A-Za-z_]\w*)\s*\(/g;
      let m;
      while ((m = callRe.exec(line)) !== null) {
        const name = m[1];
        if (
          !seen.has(name) &&
          !/^(if|while|for|loop|when|case|begin|end|declare|exception|raise|return|null|and|or|not|in|out|is|then|else|elsif|procedure|function|package|type|subtype|with|use|pragma)$/i.test(name)
        ) {
          seen.add(name);
          callees.push(name);
        }
      }
    }

    graph[caller.name] = callees;
  });

  return graph;
}

// ── Global read/write ─────────────────────────────────────────────────────────

function buildGlobalReadWrite(
  lines: string[],
  subprograms: Subprogram[],
  _filePath: string
): { read: string[]; write: string[] } {
  // Collect global variable names (declared outside all subprograms)
  const globalNames = collectGlobalVarNames(lines, subprograms);

  const reads = new Set<string>();
  const writes = new Set<string>();

  subprograms.forEach((sub) => {
    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;

      globalNames.forEach((gv) => {
        if (new RegExp(`\\b${gv}\\s*:=`, 'i').test(line)) writes.add(gv);
        else if (new RegExp(`\\b${gv}\\b`, 'i').test(line)) reads.add(gv);
      });
    }
  });

  return { read: Array.from(reads), write: Array.from(writes) };
}

// ── Cyclomatic complexity ─────────────────────────────────────────────────────

function buildCyclomaticComplexity(
  lines: string[],
  subprograms: Subprogram[]
): Record<string, number> {
  const result: Record<string, number> = {};

  subprograms.forEach((sub) => {
    let cc = 1;
    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;
      if (/\bif\b/i.test(line)) cc++;
      if (/\belsif\b/i.test(line)) cc++;
      if (/\bwhen\b/i.test(line)) cc++;
      if (/\bloop\b/i.test(line)) cc++;
      if (/\bwhile\b/i.test(line)) cc++;
      if (/\bfor\b/i.test(line)) cc++;
      if (/\band\s+then\b/i.test(line)) cc++;
      if (/\bor\s+else\b/i.test(line)) cc++;
      if (/\bexception\b/i.test(line)) cc++;
    }
    result[sub.name] = cc;
  });

  return result;
}

// ── Dead code detection ───────────────────────────────────────────────────────

function detectDeadCode(lines: string[], subprograms: Subprogram[]): string[] {
  const dead: string[] = [];

  subprograms.forEach((sub) => {
    let afterUnconditionalReturn = false;

    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;
      const trimmed = line.trim();

      // Reset on block boundaries
      if (/^\s*(end|else|elsif|when)\b/i.test(line)) {
        afterUnconditionalReturn = false;
        continue;
      }

      // Detect unconditional return/raise (not inside if/when)
      if (/^\s*return\s*;/i.test(line) || /^\s*return\s+\w/i.test(line)) {
        afterUnconditionalReturn = true;
        continue;
      }
      if (/^\s*raise\s+\w/i.test(line)) {
        afterUnconditionalReturn = true;
        continue;
      }

      // Code after unconditional return = dead
      if (
        afterUnconditionalReturn &&
        trimmed &&
        trimmed !== 'begin' &&
        !/^\s*end\s+\w+\s*;/i.test(line)
      ) {
        if (!dead.includes(sub.name)) dead.push(sub.name);
        afterUnconditionalReturn = false;
      }
    }
  });

  return dead;
}

// ── Variables info ────────────────────────────────────────────────────────────

function buildVariablesInfo(lines: string[], subprograms: Subprogram[]): VariablesForFile {
  const global_variables: Record<string, Record<string, { type: string }>> = {};
  const global_constants: Record<string, Record<string, { type: string }>> = {};
  const local_variables: Record<string, Record<string, { type: string }>> = {};

  // Initialize buckets per subprogram
  subprograms.forEach((s) => {
    global_variables[s.name] = {};
    global_constants[s.name] = {};
    local_variables[s.name] = {};
  });

  // Regex: NAME : [constant] TYPE [:= ...];
  const varRe = /^\s*([\w]+)\s*:\s*(constant\s+)?([\w.]+(?:\s*\([\w\s,.]+\))?)\s*(?::=\s*[^;]+?)?\s*;/i;
  const skipRe = /^\s*(procedure|function|package|type|subtype|task|protected|entry|with|use|pragma|begin|end|is|then|else|elsif|loop|return|raise|null|when|others|declare|exception)\b/i;

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    if (!line.trim() || line.trim().startsWith('--')) return;
    if (skipRe.test(line)) return;

    const m = varRe.exec(line);
    if (!m) return;

    const name = m[1].trim();
    const isConst = !!m[2];
    const datatype = m[3].trim();

    // Skip Ada keywords
    if (/^(begin|end|is|then|else|loop|return|raise|null|when|others|declare|exception|procedure|function|package|type|subtype|constant|with|use|in|out|and|or|not|if|for|while|case|record|array|access|new|of|at|mod|rem|xor|abs|true|false)$/i.test(name)) return;
    if (/^(in|out|return|is|begin|end|then|else|loop|when|others)$/i.test(datatype)) return;
    if (!/^\w+$/.test(name)) return;

    // Find owning subprogram
    const ownerSub = subprograms.find(
      (s) => lineNum > s.startLine && lineNum <= s.endLine
    );

    // Skip if it's a parameter
    if (ownerSub) {
      if (ownerSub.parameters.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    }

    const entry = { type: datatype };

    if (ownerSub) {
      // Local variable inside a subprogram
      if (isConst) {
        global_constants[ownerSub.name] = global_constants[ownerSub.name] || {};
        global_constants[ownerSub.name][name] = entry;
      } else {
        local_variables[ownerSub.name] = local_variables[ownerSub.name] || {};
        local_variables[ownerSub.name][name] = entry;
      }
    } else {
      // Package-level global — assign to all subprograms (matches backend behavior)
      subprograms.forEach((s) => {
        if (isConst) {
          global_constants[s.name] = global_constants[s.name] || {};
          global_constants[s.name][name] = entry;
        } else {
          global_variables[s.name] = global_variables[s.name] || {};
          global_variables[s.name][name] = entry;
        }
      });
    }
  });

  return { global_variables, global_constants, local_variables };
}

// ── Control flow extractor ────────────────────────────────────────────────────

function buildControlFlow(
  lines: string[],
  subprograms: Subprogram[]
): Record<string, ControlFlowEntry> {
  const result: Record<string, ControlFlowEntry> = {};

  subprograms.forEach((sub) => {
    const if_conditions: IfCondition[] = [];
    const branch_body_variables: Record<string, BranchVar> = {};
    const procedure_calls: string[] = [];
    const seenCalls = new Set<string>();

    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;

      // if condition
      const ifM = /^\s*if\s+(.+?)\s+then\s*$/i.exec(line);
      if (ifM) {
        const cond = ifM[1].trim();
        if_conditions.push({
          condition_text: cond,
          branch_type: 'if',
          nesting_depth: 0,
          variables: extractConditionVars(cond),
        });
      }

      // elsif condition
      const elsifM = /^\s*elsif\s+(.+?)\s+then\s*$/i.exec(line);
      if (elsifM) {
        const cond = elsifM[1].trim();
        if_conditions.push({
          condition_text: cond,
          branch_type: 'elsif',
          nesting_depth: 0,
          variables: extractConditionVars(cond),
        });
      }

      // when condition (case)
      const whenM = /^\s*when\s+(.+?)\s*=>/i.exec(line);
      if (whenM) {
        const cond = whenM[1].trim();
        if_conditions.push({
          condition_text: cond,
          branch_type: 'when',
          nesting_depth: 0,
          variables: extractConditionVars(cond),
        });
      }

      // Assignment → branch_body_variables
      const assignM = /^\s*(\w+)\s*:=\s*(.+?)\s*;/.exec(line);
      if (assignM) {
        const varName = assignM[1];
        const rhs = assignM[2];
        if (!/^(begin|end|is|then|else|loop|return|raise|null|when|others)$/i.test(varName)) {
          branch_body_variables[varName] = {
            kind: 'assignment',
            data_type: { type: inferType(rhs) },
            used_in_branch: '',
            assigned_from: rhs,
          };
        }
      }

      // Procedure calls
      const callRe = /\b([A-Za-z_]\w*)\s*\(/g;
      let cm;
      while ((cm = callRe.exec(line)) !== null) {
        const name = cm[1];
        if (
          !seenCalls.has(name) &&
          !/^(if|while|for|loop|when|case|begin|end|declare|exception|raise|return|null|and|or|not|in|out|is|then|else|elsif|procedure|function|package|type|subtype|with|use|pragma|integer|float|boolean|natural|positive|character|string)$/i.test(name)
        ) {
          seenCalls.add(name);
          procedure_calls.push(name);
        }
      }
    }

    result[sub.name] = { if_conditions, branch_body_variables, procedure_calls };
  });

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectGlobalVarNames(lines: string[], subprograms: Subprogram[]): string[] {
  const names: string[] = [];
  const varRe = /^\s*([\w]+)\s*:\s*(?:constant\s+)?([\w.]+)/i;
  const skipRe = /^\s*(procedure|function|package|type|subtype|task|protected|entry|with|use|pragma|begin|end|is|then|else|elsif|loop|return|raise|null|when|others|declare|exception)\b/i;

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    if (!line.trim() || line.trim().startsWith('--')) return;
    if (skipRe.test(line)) return;
    const m = varRe.exec(line);
    if (!m) return;
    const name = m[1].trim();
    if (!/^\w+$/.test(name)) return;
    const inAnySub = subprograms.some((s) => lineNum > s.startLine && lineNum <= s.endLine);
    if (!inAnySub && !names.includes(name)) names.push(name);
  });

  return names;
}

function extractConditionVars(
  cond: string
): Record<string, { kind: string; data_type: { type: string } }> {
  const vars: Record<string, { kind: string; data_type: { type: string } }> = {};
  const identRe = /\b([A-Za-z_]\w*)\b/g;
  let m;
  while ((m = identRe.exec(cond)) !== null) {
    const name = m[1];
    if (
      !/^(and|or|not|in|out|if|then|else|elsif|when|true|false|null|integer|float|boolean|natural|positive)$/i.test(name)
    ) {
      vars[name] = { kind: 'unresolved', data_type: { type: 'Unknown' } };
    }
  }
  return vars;
}

function inferType(rhs: string): string {
  if (/^\d+$/.test(rhs.trim())) return 'Integer';
  if (/^\d+\.\d+$/.test(rhs.trim())) return 'Float';
  if (/^(true|false)$/i.test(rhs.trim())) return 'Boolean';
  if (/^"/.test(rhs.trim())) return 'String';
  if (/^'.'$/.test(rhs.trim())) return 'Character';
  return 'Unknown';
}
