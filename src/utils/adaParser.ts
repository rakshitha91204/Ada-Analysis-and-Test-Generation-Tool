import { Subprogram, Parameter, SubprogramKind } from '../types/subprogram.types';

/**
 * Parse Ada source code and extract subprogram definitions.
 */
export function parseSubprograms(content: string, fileId: string): Subprogram[] {
  const lines = content.split('\n');
  const subprograms: Subprogram[] = [];

  // Regex to match procedure or function declarations
  const subprogramStartRe = /^\s*(procedure|function)\s+(\w+)\s*(\(|;|return|is)/i;
  const returnTypeRe = /\breturn\s+([\w.]+)/i;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = subprogramStartRe.exec(line);

    if (match) {
      const kind = match[1].toLowerCase() as SubprogramKind;
      const name = match[2];
      const startLine = i + 1;

      // Collect the full signature (may span multiple lines until 'is' or ';')
      let sigLines = line;
      let j = i;
      while (j < lines.length && !/(^\s*is\b|;\s*$)/i.test(sigLines)) {
        j++;
        if (j < lines.length) sigLines += '\n' + lines[j];
        if (j - i > 20) break; // safety limit
      }

      // Find end line (look for matching 'end NAME;')
      let endLine = startLine;
      const endRe = new RegExp(`^\\s*end\\s+${name}\\s*;`, 'i');
      for (let k = j; k < lines.length; k++) {
        if (endRe.test(lines[k])) {
          endLine = k + 1;
          break;
        }
      }
      if (endLine === startLine) endLine = Math.min(startLine + 30, lines.length);

      // Parse parameters
      const parameters = parseParameters(sigLines);

      // Parse return type
      let returnType: string | undefined;
      if (kind === 'function') {
        const retMatch = returnTypeRe.exec(sigLines);
        if (retMatch) returnType = retMatch[1];
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
      });

      i = j + 1;
    } else {
      i++;
    }
  }

  return subprograms;
}

function parseParameters(sig: string): Parameter[] {
  const params: Parameter[] = [];

  // Extract content between parentheses
  const parenMatch = /\(([^)]+)\)/s.exec(sig);
  if (!parenMatch) return params;

  const paramStr = parenMatch[1];
  // Split by semicolons
  const paramGroups = paramStr.split(';');

  for (const group of paramGroups) {
    const trimmed = group.trim();
    if (!trimmed) continue;

    // Match: NAME [, NAME]* : [in out | in | out] TYPE
    const paramRe = /^([\w\s,]+?)\s*:\s*(in\s+out|in|out)?\s*([\w.]+)\s*$/i;
    const m = paramRe.exec(trimmed);
    if (!m) continue;

    const names = m[1].split(',').map((n) => n.trim()).filter(Boolean);
    const modeRaw = (m[2] || 'in').trim().toLowerCase();
    const mode: Parameter['mode'] =
      modeRaw === 'in out' ? 'in out' : modeRaw === 'out' ? 'out' : 'in';
    const paramType = m[3].trim();

    for (const name of names) {
      params.push({ name, paramType, mode });
    }
  }

  return params;
}
