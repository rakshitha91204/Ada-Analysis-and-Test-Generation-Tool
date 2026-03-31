import { Subprogram, Parameter, SubprogramKind } from '../types/subprogram.types';

export interface AdaPackageInfo {
  name: string;
  startLine: number;
  endLine: number;
  isBody: boolean;
}

export interface AdaTaskInfo {
  name: string;
  startLine: number;
  endLine: number;
  entries: string[];
}

export interface AdaExceptionInfo {
  name: string;
  line: number;
}

export interface AdaWithClause {
  packageName: string;
  line: number;
}

export interface AdaFileAnalysis {
  subprograms: Subprogram[];
  packages: AdaPackageInfo[];
  tasks: AdaTaskInfo[];
  exceptions: AdaExceptionInfo[];
  withClauses: AdaWithClause[];
  useClauses: string[];
}

/**
 * Full Ada source analysis — extracts subprograms, packages, tasks,
 * exceptions, and with/use clauses.
 */
export function analyzeAdaFile(content: string, fileId: string): AdaFileAnalysis {
  return {
    subprograms: parseSubprograms(content, fileId),
    packages: parsePackages(content),
    tasks: parseTasks(content),
    exceptions: parseExceptions(content),
    withClauses: parseWithClauses(content),
    useClauses: parseUseClauses(content),
  };
}

/**
 * Parse Ada source code and extract subprogram definitions.
 */
export function parseSubprograms(content: string, fileId: string): Subprogram[] {
  const lines = content.split('\n');
  const subprograms: Subprogram[] = [];
  const subprogramStartRe = /^\s*(procedure|function)\s+(\w+)\s*(\(|;|return|is)/i;
  const returnTypeRe = /\breturn\s+([\w.]+)/i;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Skip comment lines
    if (/^\s*--/.test(line)) { i++; continue; }

    const match = subprogramStartRe.exec(line);
    if (match) {
      const kind = match[1].toLowerCase() as SubprogramKind;
      const name = match[2];
      const startLine = i + 1;

      // Collect full signature
      let sigLines = line;
      let j = i;
      while (j < lines.length && !/(^\s*is\b|;\s*$)/i.test(sigLines)) {
        j++;
        if (j < lines.length) sigLines += '\n' + lines[j];
        if (j - i > 30) break;
      }

      // Find end line
      let endLine = startLine;
      const endRe = new RegExp(`^\\s*end\\s+${name}\\s*;`, 'i');
      for (let k = j; k < lines.length; k++) {
        if (endRe.test(lines[k])) { endLine = k + 1; break; }
      }
      if (endLine === startLine) endLine = Math.min(startLine + 50, lines.length);

      const parameters = parseParameters(sigLines);
      let returnType: string | undefined;
      if (kind === 'function') {
        const retMatch = returnTypeRe.exec(sigLines);
        if (retMatch) returnType = retMatch[1];
      }

      // Extract doc comment (lines immediately before starting with --)
      let docComment = '';
      for (let k = i - 1; k >= Math.max(0, i - 5); k--) {
        const commentLine = lines[k].trim();
        if (commentLine.startsWith('--')) {
          docComment = commentLine.replace(/^--\s*/, '') + (docComment ? '\n' + docComment : '');
        } else break;
      }

      subprograms.push({
        id: `${fileId}_${name}_${startLine}`,
        fileId,
        name,
        kind,
        parameters,
        returnType,
        startLine,
        endLine,
        testCount: 0,
        docComment: docComment || undefined,
      } as Subprogram & { docComment?: string });

      i = j + 1;
    } else {
      i++;
    }
  }

  return subprograms;
}

function parseParameters(sig: string): Parameter[] {
  const params: Parameter[] = [];
  const parenMatch = /\(([^)]+)\)/s.exec(sig);
  if (!parenMatch) return params;

  const paramStr = parenMatch[1];
  const paramGroups = paramStr.split(';');

  for (const group of paramGroups) {
    const trimmed = group.trim();
    if (!trimmed) continue;
    const paramRe = /^([\w\s,]+?)\s*:\s*(in\s+out|in|out)?\s*([\w.]+)\s*$/i;
    const m = paramRe.exec(trimmed);
    if (!m) continue;
    const names = m[1].split(',').map((n) => n.trim()).filter(Boolean);
    const modeRaw = (m[2] || 'in').trim().toLowerCase();
    const mode: Parameter['mode'] = modeRaw === 'in out' ? 'in out' : modeRaw === 'out' ? 'out' : 'in';
    const paramType = m[3].trim();
    for (const name of names) {
      params.push({ name, paramType, mode });
    }
  }
  return params;
}

function parsePackages(content: string): AdaPackageInfo[] {
  const lines = content.split('\n');
  const packages: AdaPackageInfo[] = [];
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
      packages.push({ name, startLine: i + 1, endLine, isBody });
    }
  });
  return packages;
}

function parseTasks(content: string): AdaTaskInfo[] {
  const lines = content.split('\n');
  const tasks: AdaTaskInfo[] = [];
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
      tasks.push({ name, startLine: i + 1, endLine, entries });
    }
  });
  return tasks;
}

function parseExceptions(content: string): AdaExceptionInfo[] {
  const lines = content.split('\n');
  const exceptions: AdaExceptionInfo[] = [];
  const exRe = /^\s*(\w+)\s*:\s*exception\s*;/i;
  const raiseRe = /\braise\s+(\w[\w.]*)/i;

  lines.forEach((line, i) => {
    if (/^\s*--/.test(line)) return;
    const m = exRe.exec(line) || raiseRe.exec(line);
    if (m) exceptions.push({ name: m[1], line: i + 1 });
  });
  return exceptions;
}

function parseWithClauses(content: string): AdaWithClause[] {
  const lines = content.split('\n');
  const result: AdaWithClause[] = [];
  const withRe = /^\s*with\s+([\w.,\s]+);/i;

  lines.forEach((line, i) => {
    const m = withRe.exec(line);
    if (m) {
      m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((pkg) => {
        result.push({ packageName: pkg, line: i + 1 });
      });
    }
  });
  return result;
}

function parseUseClauses(content: string): string[] {
  const useRe = /^\s*use\s+([\w.,\s]+);/gim;
  const result: string[] = [];
  let m;
  while ((m = useRe.exec(content)) !== null) {
    m[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((pkg) => result.push(pkg));
  }
  return result;
}

/**
 * Find the corresponding spec/body file for a given file.
 * .ads → looks for matching .adb, and vice versa.
 */
export function findLinkedFile(
  fileName: string,
  allFiles: { id: string; name: string }[]
): string | null {
  const base = fileName.replace(/\.(ads|adb)$/, '');
  const isSpec = fileName.endsWith('.ads');
  const targetExt = isSpec ? '.adb' : '.ads';
  const linked = allFiles.find((f) => f.name === base + targetExt);
  return linked?.id ?? null;
}

/**
 * Find which subprogram in the body implements a spec declaration.
 * Matches by name (case-insensitive).
 */
export function findImplementation(
  specSubName: string,
  bodySubprograms: Subprogram[]
): Subprogram | null {
  return bodySubprograms.find(
    (s) => s.name.toLowerCase() === specSubName.toLowerCase()
  ) ?? null;
}
