/**
 * Comprehensive Ada source analyzer.
 * Produces a rich JSON structure from .adb / .ads files including:
 *   - subprograms (name, kind, parameters, return type, lines)
 *   - call_graph (caller → callee edges)
 *   - global_read_write (per subprogram)
 *   - cyclomatic_complexity (per subprogram)
 *   - dead_code (unreachable blocks)
 *   - variables (global + local with datatype)
 *   - control_flow (branches per subprogram)
 *   - packages, tasks, exceptions, with/use clauses
 */

import { parseSubprograms } from './adaParser';
import { Subprogram } from '../types/subprogram.types';

// ── Output types ──────────────────────────────────────────────────────────────

export interface VariableInfo {
  name: string;
  datatype: string;
  scope: 'global' | 'local';
  subprogramName?: string; // set for local variables
  line: number;
  initialValue?: string;
}

export interface CallEdge {
  caller: string;
  callee: string;
  line: number;
}

export interface GlobalReadWrite {
  subprogramName: string;
  reads: string[];
  writes: string[];
}

export interface ControlFlowBranch {
  type: 'if' | 'elsif' | 'else' | 'loop' | 'for' | 'while' | 'case' | 'when' | 'exception';
  line: number;
  condition?: string;
}

export interface SubprogramControlFlow {
  subprogramName: string;
  branches: ControlFlowBranch[];
  branchCount: number;
}

export interface DeadCodeBlock {
  reason: string;
  startLine: number;
  endLine: number;
  subprogramName?: string;
  snippet: string;
}

export interface CyclomaticComplexity {
  subprogramName: string;
  complexity: number;
  rating: 'low' | 'medium' | 'high' | 'very_high';
  details: string;
}

export interface AdaFullAnalysis {
  meta: {
    fileName: string;
    filePath: string;
    fileType: 'spec' | 'body';
    analyzedAt: string;
    totalLines: number;
    totalSubprograms: number;
  };
  packages: Array<{ name: string; isBody: boolean; startLine: number; endLine: number }>;
  with_clauses: Array<{ packageName: string; line: number }>;
  use_clauses: string[];
  subprograms: Array<{
    id: string;
    name: string;
    kind: 'procedure' | 'function';
    parameters: Array<{ name: string; paramType: string; mode: string }>;
    returnType: string | null;
    startLine: number;
    endLine: number;
    lineCount: number;
    docComment: string | null;
  }>;
  variables: VariableInfo[];
  call_graph: CallEdge[];
  global_read_write: GlobalReadWrite[];
  cyclomatic_complexity: CyclomaticComplexity[];
  control_flow: SubprogramControlFlow[];
  dead_code: DeadCodeBlock[];
  tasks: Array<{ name: string; startLine: number; endLine: number; entries: string[] }>;
  exceptions: Array<{ name: string; line: number; kind: 'declaration' | 'raise' }>;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function analyzeAdaSource(
  content: string,
  fileName: string,
  fileType: 'spec' | 'body'
): AdaFullAnalysis {
  const lines = content.split('\n');
  const fileId = fileName.replace(/\W/g, '_');
  const subprograms = parseSubprograms(content, fileId);

  return {
    meta: {
      fileName,
      filePath: fileName,
      fileType,
      analyzedAt: new Date().toISOString(),
      totalLines: lines.length,
      totalSubprograms: subprograms.length,
    },
    packages: extractPackages(lines),
    with_clauses: extractWithClauses(lines),
    use_clauses: extractUseClauses(lines),
    subprograms: subprograms.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      parameters: s.parameters,
      returnType: s.returnType ?? null,
      startLine: s.startLine,
      endLine: s.endLine,
      lineCount: s.endLine - s.startLine + 1,
      docComment: (s as Subprogram & { docComment?: string }).docComment ?? null,
    })),
    variables: extractVariables(lines, subprograms),
    call_graph: extractCallGraph(lines, subprograms),
    global_read_write: extractGlobalReadWrite(lines, subprograms),
    cyclomatic_complexity: computeCyclomaticComplexity(lines, subprograms),
    control_flow: extractControlFlow(lines, subprograms),
    dead_code: detectDeadCode(lines, subprograms),
    tasks: extractTasks(lines),
    exceptions: extractExceptions(lines),
  };
}

// ── Variables ─────────────────────────────────────────────────────────────────

function extractVariables(lines: string[], subprograms: Subprogram[]): VariableInfo[] {
  const vars: VariableInfo[] = [];
  // Match: NAME : [constant] TYPE [:= VALUE];
  const varRe = /^\s+(\w+)\s*:\s*(constant\s+)?([\w.]+(?:\s*\([\w\s,]+\))?)\s*(?::=\s*([^;]+))?;/i;

  lines.forEach((line, i) => {
    if (/^\s*--/.test(line)) return;
    // Skip procedure/function/package/type declarations
    if (/^\s*(procedure|function|package|type|subtype|task|protected)\b/i.test(line)) return;

    const m = varRe.exec(line);
    if (!m) return;

    const name = m[1];
    const datatype = m[3].trim();
    const initialValue = m[4]?.trim();
    const lineNum = i + 1;

    // Determine scope: find which subprogram this line belongs to
    const ownerSub = subprograms.find(
      (s) => lineNum > s.startLine && lineNum < s.endLine
    );

    // Skip parameter names (they appear in signatures)
    const isParam = subprograms.some((s) =>
      s.parameters.some((p) => p.name.toLowerCase() === name.toLowerCase())
    );
    if (isParam) return;

    vars.push({
      name,
      datatype,
      scope: ownerSub ? 'local' : 'global',
      subprogramName: ownerSub?.name,
      line: lineNum,
      initialValue,
    });
  });

  return vars;
}

// ── Call graph ────────────────────────────────────────────────────────────────

function extractCallGraph(lines: string[], subprograms: Subprogram[]): CallEdge[] {
  const edges: CallEdge[] = [];
  const subNames = subprograms.map((s) => s.name.toLowerCase());

  subprograms.forEach((caller) => {
    for (let i = caller.startLine; i <= caller.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;

      subNames.forEach((calleeName, idx) => {
        if (calleeName === caller.name.toLowerCase()) return; // skip self
        // Match: callee_name ( or callee_name; (procedure call without parens)
        const callRe = new RegExp(`\\b${calleeName}\\s*[\\(;]`, 'i');
        if (callRe.test(line)) {
          edges.push({
            caller: caller.name,
            callee: subprograms[idx].name,
            line: i,
          });
        }
      });
    }
  });

  // Deduplicate
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.caller}→${e.callee}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Global read/write ─────────────────────────────────────────────────────────

function extractGlobalReadWrite(lines: string[], subprograms: Subprogram[]): GlobalReadWrite[] {
  // Find global variables (declared outside any subprogram)
  const globalVarRe = /^\s{0,4}(\w+)\s*:\s*(?:constant\s+)?[\w.]+/i;
  const globalVars: string[] = [];

  lines.forEach((line, i) => {
    if (/^\s*--/.test(line)) return;
    if (/^\s*(procedure|function|package|type|subtype|task|with|use)\b/i.test(line)) return;
    const m = globalVarRe.exec(line);
    if (m) {
      const lineNum = i + 1;
      const inAnySub = subprograms.some((s) => lineNum > s.startLine && lineNum < s.endLine);
      if (!inAnySub) globalVars.push(m[1]);
    }
  });

  return subprograms.map((sub) => {
    const reads: string[] = [];
    const writes: string[] = [];

    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;

      globalVars.forEach((gv) => {
        const assignRe = new RegExp(`\\b${gv}\\s*:=`, 'i');
        const readRe = new RegExp(`\\b${gv}\\b`, 'i');
        if (assignRe.test(line)) {
          if (!writes.includes(gv)) writes.push(gv);
        } else if (readRe.test(line)) {
          if (!reads.includes(gv)) reads.push(gv);
        }
      });
    }

    return { subprogramName: sub.name, reads, writes };
  });
}

// ── Cyclomatic complexity ─────────────────────────────────────────────────────

function computeCyclomaticComplexity(lines: string[], subprograms: Subprogram[]): CyclomaticComplexity[] {
  return subprograms.map((sub) => {
    let complexity = 1; // base

    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;
      // Each decision point adds 1
      if (/\bif\b/i.test(line)) complexity++;
      if (/\belsif\b/i.test(line)) complexity++;
      if (/\bwhen\b/i.test(line)) complexity++;
      if (/\bloop\b/i.test(line)) complexity++;
      if (/\bwhile\b/i.test(line)) complexity++;
      if (/\bfor\b/i.test(line)) complexity++;
      if (/\band\s+then\b/i.test(line)) complexity++;
      if (/\bor\s+else\b/i.test(line)) complexity++;
      if (/\bexception\b/i.test(line)) complexity++;
    }

    const rating: CyclomaticComplexity['rating'] =
      complexity <= 5 ? 'low' :
      complexity <= 10 ? 'medium' :
      complexity <= 20 ? 'high' : 'very_high';

    const details =
      complexity <= 5 ? 'Simple, easy to test' :
      complexity <= 10 ? 'Moderate complexity' :
      complexity <= 20 ? 'High complexity — consider refactoring' :
      'Very high — difficult to test, refactor recommended';

    return { subprogramName: sub.name, complexity, rating, details };
  });
}

// ── Control flow ──────────────────────────────────────────────────────────────

function extractControlFlow(lines: string[], subprograms: Subprogram[]): SubprogramControlFlow[] {
  return subprograms.map((sub) => {
    const branches: ControlFlowBranch[] = [];

    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;
      const trimmed = line.trim();

      if (/^\s*if\s+(.+)\s+then/i.test(line)) {
        const cond = /^\s*if\s+(.+)\s+then/i.exec(line)?.[1]?.trim();
        branches.push({ type: 'if', line: i, condition: cond });
      } else if (/^\s*elsif\s+/i.test(line)) {
        const cond = /^\s*elsif\s+(.+)\s+then/i.exec(line)?.[1]?.trim();
        branches.push({ type: 'elsif', line: i, condition: cond });
      } else if (/^\s*else\s*$/i.test(trimmed)) {
        branches.push({ type: 'else', line: i });
      } else if (/^\s*for\s+\w+\s+in\s+/i.test(line)) {
        const cond = /^\s*for\s+(.+)\s+loop/i.exec(line)?.[1]?.trim();
        branches.push({ type: 'for', line: i, condition: cond });
      } else if (/^\s*while\s+/i.test(line)) {
        const cond = /^\s*while\s+(.+)\s+loop/i.exec(line)?.[1]?.trim();
        branches.push({ type: 'while', line: i, condition: cond });
      } else if (/^\s*loop\s*$/i.test(trimmed)) {
        branches.push({ type: 'loop', line: i });
      } else if (/^\s*case\s+/i.test(line)) {
        const cond = /^\s*case\s+(.+)\s+is/i.exec(line)?.[1]?.trim();
        branches.push({ type: 'case', line: i, condition: cond });
      } else if (/^\s*when\s+/i.test(line)) {
        const cond = /^\s*when\s+(.+)\s*=>/i.exec(line)?.[1]?.trim();
        branches.push({ type: 'when', line: i, condition: cond });
      } else if (/^\s*exception\s*$/i.test(trimmed)) {
        branches.push({ type: 'exception', line: i });
      }
    }

    return { subprogramName: sub.name, branches, branchCount: branches.length };
  });
}

// ── Dead code detection ───────────────────────────────────────────────────────

function detectDeadCode(lines: string[], subprograms: Subprogram[]): DeadCodeBlock[] {
  const dead: DeadCodeBlock[] = [];

  subprograms.forEach((sub) => {
    let afterReturn = false;
    let afterReturnLine = -1;

    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*--/.test(line)) continue;
      const trimmed = line.trim();

      // Detect unconditional return/raise
      if (/^\s*return\s*;/i.test(line) || /^\s*return\s+\w/i.test(line)) {
        afterReturn = true;
        afterReturnLine = i;
        continue;
      }
      if (/^\s*raise\s+\w/i.test(line) && !/^\s*when\b/i.test(line)) {
        afterReturn = true;
        afterReturnLine = i;
        continue;
      }

      // If we hit end/else/elsif/when after a return, reset
      if (/^\s*(end|else|elsif|when)\b/i.test(line)) {
        afterReturn = false;
        continue;
      }

      // Code after unconditional return
      if (afterReturn && trimmed && trimmed !== 'begin' && !/^\s*(end\s+\w+\s*;)/i.test(line)) {
        dead.push({
          reason: `Unreachable code after unconditional return/raise at line ${afterReturnLine}`,
          startLine: i,
          endLine: i,
          subprogramName: sub.name,
          snippet: trimmed.slice(0, 80),
        });
        afterReturn = false; // report once per block
      }
    }

    // Detect: when others => null; (empty exception handler — potential dead code)
    for (let i = sub.startLine; i <= sub.endLine && i <= lines.length; i++) {
      const line = lines[i - 1] ?? '';
      if (/^\s*when\s+others\s*=>\s*null\s*;/i.test(line)) {
        dead.push({
          reason: 'Empty exception handler (when others => null) — exceptions silently swallowed',
          startLine: i,
          endLine: i,
          subprogramName: sub.name,
          snippet: line.trim(),
        });
      }
    }
  });

  return dead;
}

// ── Packages ──────────────────────────────────────────────────────────────────

function extractPackages(lines: string[]) {
  const result: Array<{ name: string; isBody: boolean; startLine: number; endLine: number }> = [];
  const pkgRe = /^\s*package\s+(body\s+)?([\w.]+)\s+is/i;

  lines.forEach((line, i) => {
    if (/^\s*--/.test(line)) return;
    const m = pkgRe.exec(line);
    if (m) {
      const isBody = !!m[1];
      const name = m[2];
      let endLine = i + 1;
      const endRe = new RegExp(`^\\s*end\\s+${name.replace('.', '\\.')}\\s*;`, 'i');
      for (let k = i + 1; k < lines.length; k++) {
        if (endRe.test(lines[k])) { endLine = k + 1; break; }
      }
      result.push({ name, isBody, startLine: i + 1, endLine });
    }
  });
  return result;
}

// ── With / Use ────────────────────────────────────────────────────────────────

function extractWithClauses(lines: string[]) {
  const result: Array<{ packageName: string; line: number }> = [];
  lines.forEach((line, i) => {
    const m = /^\s*with\s+([\w.,\s]+);/i.exec(line);
    if (m) {
      m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((pkg) => {
        result.push({ packageName: pkg, line: i + 1 });
      });
    }
  });
  return result;
}

function extractUseClauses(lines: string[]): string[] {
  const result: string[] = [];
  lines.forEach((line) => {
    const m = /^\s*use\s+([\w.,\s]+);/i.exec(line);
    if (m) m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((p) => result.push(p));
  });
  return result;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function extractTasks(lines: string[]) {
  const result: Array<{ name: string; startLine: number; endLine: number; entries: string[] }> = [];
  const taskRe = /^\s*task\s+(body\s+)?(\w+)/i;
  const entryRe = /^\s*entry\s+(\w+)/i;

  lines.forEach((line, i) => {
    if (/^\s*--/.test(line)) return;
    const m = taskRe.exec(line);
    if (m) {
      const name = m[2];
      const entries: string[] = [];
      let endLine = i + 1;
      for (let k = i + 1; k < Math.min(i + 100, lines.length); k++) {
        const em = entryRe.exec(lines[k]);
        if (em) entries.push(em[1]);
        if (/^\s*end\s+\w+\s*;/i.test(lines[k])) { endLine = k + 1; break; }
      }
      result.push({ name, startLine: i + 1, endLine, entries });
    }
  });
  return result;
}

// ── Exceptions ────────────────────────────────────────────────────────────────

function extractExceptions(lines: string[]) {
  const result: Array<{ name: string; line: number; kind: 'declaration' | 'raise' }> = [];
  lines.forEach((line, i) => {
    if (/^\s*--/.test(line)) return;
    const declM = /^\s*(\w+)\s*:\s*exception\s*;/i.exec(line);
    if (declM) result.push({ name: declM[1], line: i + 1, kind: 'declaration' });
    const raiseM = /\braise\s+(\w[\w.]*)/i.exec(line);
    if (raiseM) result.push({ name: raiseM[1], line: i + 1, kind: 'raise' });
  });
  return result;
}
