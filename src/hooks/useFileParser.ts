/**
 * useFileParser.ts
 * ================
 * Parses Ada files ONLY when explicitly triggered (on click).
 *
 * When a file is clicked, ALL uploaded Ada files are sent together to the
 * backend for cross-file type resolution, but the combined result is then
 * SPLIT per-file so each file gets its own JSON in the JSON panel.
 *
 * Exposes: parseFile(file) — call this on file click.
 *
 * Strategy (with graceful fallback):
 *   1. Try the Python FastAPI backend (/analyze).
 *   2. If unavailable, fall back to client-side TypeScript analyzer.
 */

import { useRef, useCallback } from 'react';
import { useFileStore } from '../store/useFileStore';
import { useSubprogramStore } from '../store/useSubprogramStore';
import { useParseStore } from '../store/useParseStore';
import { parseSubprograms } from '../utils/adaParser';
import { analyzeAdaSource, AdaAnalysisResult } from '../utils/adaAnalyzer';
import { analyzeFiles, checkHealth } from '../utils/apiClient';
import type { AdaFile } from '../types/file.types';
import type { Subprogram } from '../types/subprogram.types';

// Cache backend availability — re-check every 5 s (short to recover quickly after restart)
let backendAvailable: boolean | null = null;
let backendCheckTimer: ReturnType<typeof setTimeout> | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  const health = await checkHealth();
  backendAvailable = health !== null && health.libadalang_available === true;
  // Clear cache after 5 s so a restarted backend is detected quickly
  if (backendCheckTimer) clearTimeout(backendCheckTimer);
  backendCheckTimer = setTimeout(() => { backendAvailable = null; }, 5_000);
  return backendAvailable;
}

/**
 * Split a combined multi-file analysis result into one slice per file.
 * Each slice contains only the data for that specific file, while
 * still showing the full call graph (cross-file calls are useful context).
 */
function splitAnalysisByFile(
  combined: AdaAnalysisResult
): Map<string, AdaAnalysisResult> {
  const results = new Map<string, AdaAnalysisResult>();

  for (const fp of (combined.file_paths ?? [])) {
    const baseName = fp.split(/[/\\]/).pop() ?? fp;

    // Subprograms for just this file
    const subpIndex = combined.subprogram_index?.[fp]
      ?? combined.subprogram_index?.[baseName]
      ?? [];

    // Skip if no subprograms and no variables (e.g. empty .ads spec files)
    const hasVars = !!(combined.variables_info?.[fp] ?? combined.variables_info?.[baseName]);
    if (subpIndex.length === 0 && !hasVars) continue;

    const slice: AdaAnalysisResult = {
      // Keep only this file in file_paths
      file_paths:            [baseName],

      // AST — just this file
      ast_info:              { [baseName]: (combined.ast_info?.[fp] ?? combined.ast_info?.[baseName] ?? 'CompilationUnit') },

      // Subprograms — just this file
      subprogram_index:      { [baseName]: subpIndex },

      // Call graph — full (cross-file calls are useful)
      call_graph:            combined.call_graph ?? {},

      // Complexity, dead code — filter to subprograms in this file
      cyclomatic_complexity: Object.fromEntries(
        subpIndex.map(s => [s.name, (combined.cyclomatic_complexity ?? {})[s.name]])
          .filter(([, v]) => v != null) as [string, number][]
      ),
      dead_code: (combined.dead_code ?? []).filter(
        name => subpIndex.some(s => s.name === name)
      ),

      // Variables — just this file
      variables_info: {
        [baseName]: combined.variables_info?.[fp]
          ?? combined.variables_info?.[baseName]
          ?? { global_variables: {}, global_constants: {}, local_variables: {} },
      },

      // Control flow — just this file
      control_flow_extractor: {
        [baseName]: combined.control_flow_extractor?.[fp]
          ?? combined.control_flow_extractor?.[baseName]
          ?? {},
      },

      // Global read/write — just this file
      global_read_write: {
        [baseName]: combined.global_read_write?.[fp]
          ?? combined.global_read_write?.[baseName]
          ?? { read: [], write: [] },
      },

      // Loop/exception info — filter to this file's subprograms
      loop_info: Object.fromEntries(
        subpIndex.map(s => [s.name, (combined.loop_info ?? {})[s.name]])
          .filter(([, v]) => v != null) as [string, number][]
      ),
      exceptions_info: Object.fromEntries(
        subpIndex.map(s => [s.name, (combined.exceptions_info ?? {})[s.name]])
          .filter(([, v]) => v != null) as [string, number][]
      ),

      // Concurrency / protected / logical errors — whole project level
      concurrency_info:   combined.concurrency_info,
      protected_objects:  combined.protected_objects,
      logical_errors:     combined.logical_errors,

      // Bug report — filter to this file's subprograms
      bug_report: combined.bug_report ? {
        division_by_zero:       (combined.bug_report.division_by_zero ?? []).filter(e => subpIndex.some(s => s.name === e.subprogram)),
        uninitialized_variables:(combined.bug_report.uninitialized_variables ?? []).filter(e => subpIndex.some(s => s.name === e.subprogram)),
        null_dereference:       (combined.bug_report.null_dereference ?? []).filter(e => subpIndex.some(s => s.name === e.subprogram)),
        infinite_loops:         (combined.bug_report.infinite_loops ?? []).filter(e => subpIndex.some(s => s.name === e.subprogram)),
        unreachable_code:       (combined.bug_report.unreachable_code ?? []).filter(e => subpIndex.some(s => s.name === e.subprogram)),
      } : undefined,

      performance_warnings: combined.performance_warnings,

      // Test harness / mocks — just this file
      test_harness_data: {
        [baseName]: combined.test_harness_data?.[fp]
          ?? combined.test_harness_data?.[baseName]
          ?? [],
      },
      mock_stub_data: Object.fromEntries(
        subpIndex.map(s => [s.name, (combined.mock_stub_data ?? {})[s.name]])
          .filter(([, v]) => v != null)
      ),
    };

    results.set(baseName, slice);
  }

  return results;
}

/**
 * Convert backend subprogram_index entries into Subprogram[] for the store.
 * Uses the richer libadalang data (accurate line numbers, parameter strings, return types).
 */
function backendSubprogramsToStore(
  analysis: AdaAnalysisResult,
  fileId: string,
  uploadedFileName?: string
): Subprogram[] {
  const filePath = analysis.file_paths?.[0] ?? '';

  // Try exact match first, then basename match, then first key
  let entries = analysis.subprogram_index?.[filePath];
  if (!entries && uploadedFileName) {
    const baseName = uploadedFileName.split(/[/\\]/).pop() ?? uploadedFileName;
    entries = analysis.subprogram_index?.[baseName]
      ?? Object.entries(analysis.subprogram_index ?? {}).find(
           ([k]) => k.split(/[/\\]/).pop() === baseName
         )?.[1];
  }
  if (!entries) {
    entries = Object.values(analysis.subprogram_index ?? {})[0] ?? [];
  }

  return entries.map((s) => {
    const params: Subprogram['parameters'] = [];
    for (const raw of (s.parameters ?? [])) {
      const segments = raw.split(';').map((x: string) => x.trim()).filter(Boolean);
      for (const segment of segments) {
        const parts = segment.split(':').map((x: string) => x.trim());
        const namePart = parts[0] ?? 'param';
        const typePart = parts.slice(1).join(':').trim();
        const modeMatch = /^(in\s+out|in|out)\s+(.+)$/i.exec(typePart);
        params.push({
          name: namePart,
          paramType: modeMatch ? modeMatch[2].trim() : typePart || 'Unknown',
          mode: (modeMatch ? modeMatch[1].toLowerCase().replace(/\s+/, ' ').trim() : 'in') as 'in' | 'out' | 'in out',
        });
      }
    }

    return {
      id: `${fileId}_${s.name}_${s.start_line}`,
      fileId,
      name: s.name,
      kind: (s.is_function || !!s.return_type ? 'function' : 'procedure') as 'function' | 'procedure',
      parameters: params,
      returnType: s.return_type ?? undefined,
      startLine: s.start_line,
      endLine: s.end_line,
      testCount: 0,
    };
  });
}

export function useFileParser() {
  const { updateFileStatus, files: allFiles } = useFileStore();
  const { setSubprograms, subprograms } = useSubprogramStore();
  const { setResult, syncToFile } = useParseStore();
  const subprogramsRef = useRef(subprograms);
  subprogramsRef.current = subprograms;
  const parsingIds = useRef<Set<string>>(new Set());

  const parseFile = useCallback(async (file: AdaFile) => {
    if (parsingIds.current.has(file.id)) return;
    parsingIds.current.add(file.id);

    updateFileStatus(file.id, 'parsing');

    try {
      const useBackend = await isBackendAvailable();

      if (useBackend) {
        try {
          // Send ALL Ada files together for cross-file type resolution
          const filesToSend = allFiles
            .filter(f => f.content && (f.name.endsWith('.adb') || f.name.endsWith('.ads') || f.name.endsWith('.ada')))
            .map(f => ({ name: f.name, content: f.content }));

          if (!filesToSend.find(f => f.name === file.name)) {
            filesToSend.push({ name: file.name, content: file.content });
          }

          const combinedResult = await analyzeFiles(filesToSend);

          // ── Split combined result into per-file slices ─────────────────
          const perFile = splitAnalysisByFile(combinedResult);

          // Store each file's slice under its own ID
          let clickedFileResult: AdaAnalysisResult | null = null;

          for (const [baseName, slice] of perFile.entries()) {
            // Find the AdaFile in the store whose name matches this basename
            const matchedFile = allFiles.find(f =>
              (f.name.split(/[/\\]/).pop() ?? f.name) === baseName
            );
            if (!matchedFile) continue;

            const subs = backendSubprogramsToStore(slice, matchedFile.id, matchedFile.name);
            const finalSubs = subs.length > 0 ? subs : parseSubprograms(matchedFile.content, matchedFile.id);

            setResult(matchedFile.id, {
              fileId:    matchedFile.id,
              fileName:  matchedFile.name,
              parsedAt:  new Date().toISOString(),
              subprograms: finalSubs,
              analysis:  slice,
              jsonText:  JSON.stringify(slice, null, 2),
            });
            syncToFile(matchedFile.id);
            updateFileStatus(matchedFile.id, 'parsed');

            // Merge subprograms
            const kept = subprogramsRef.current.filter(s => s.fileId !== matchedFile.id);
            subprogramsRef.current = [...kept, ...finalSubs];
            setSubprograms(subprogramsRef.current);

            if (matchedFile.id === file.id) {
              clickedFileResult = slice;
            }
          }

          // If the clicked file had no subprograms (e.g. .ads spec), still mark it parsed
          if (!clickedFileResult) {
            const baseName = file.name.split(/[/\\]/).pop() ?? file.name;
            const slice: AdaAnalysisResult = {
              file_paths: [baseName],
              ast_info: { [baseName]: combinedResult.ast_info?.[baseName] ?? 'CompilationUnit' },
              subprogram_index: { [baseName]: [] },
              call_graph: {},
              cyclomatic_complexity: {},
              dead_code: [],
              variables_info: {
                [baseName]: combinedResult.variables_info?.[baseName]
                  ?? { global_variables: {}, global_constants: {}, local_variables: {} },
              },
              control_flow_extractor: { [baseName]: {} },
              global_read_write: { [baseName]: { read: [], write: [] } },
            };
            setResult(file.id, {
              fileId: file.id, fileName: file.name,
              parsedAt: new Date().toISOString(),
              subprograms: [],
              analysis: slice,
              jsonText: JSON.stringify(slice, null, 2),
            });
            syncToFile(file.id);
            updateFileStatus(file.id, 'parsed');
          }

          return;
        } catch (backendErr) {
          console.warn('[useFileParser] Backend failed, falling back:', backendErr);
          backendAvailable = null;
          if (backendCheckTimer) { clearTimeout(backendCheckTimer); backendCheckTimer = null; }
        }
      }

      // ── Client-side fallback ─────────────────────────────────────────────
      const fileType = file.name.endsWith('.ads') ? 'spec' : 'body';
      const subs = parseSubprograms(file.content, file.id);
      const analysis = analyzeAdaSource(file.content, file.name, fileType);

      setResult(file.id, {
        fileId: file.id,
        fileName: file.name,
        parsedAt: new Date().toISOString(),
        subprograms: subs,
        analysis,
        jsonText: JSON.stringify(analysis, null, 2),
      });

      syncToFile(file.id);
      updateFileStatus(file.id, 'parsed');

      const kept = subprogramsRef.current.filter(s => s.fileId !== file.id);
      setSubprograms([...kept, ...subs]);

    } catch (err) {
      updateFileStatus(file.id, 'error', err instanceof Error ? err.message : 'Parse error');
    } finally {
      parsingIds.current.delete(file.id);
    }
  }, [updateFileStatus, setResult, syncToFile, setSubprograms, allFiles]);

  return { parseFile };
}
