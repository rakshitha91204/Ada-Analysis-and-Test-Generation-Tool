/**
 * useFileParser.ts
 * ================
 * Parses Ada files ONLY when explicitly triggered (on click).
 *
 * Files are NOT auto-parsed on upload. JSON is generated only when
 * the user clicks a file in the Files panel.
 *
 * Exposes: parseFile(file) — call this on file click.
 *
 * Strategy (with graceful fallback):
 *   1. Try the Python FastAPI backend (/api/analyze).
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

// Cache backend availability — re-check every 30 s
let backendAvailable: boolean | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  const health = await checkHealth();
  backendAvailable = health !== null && health.libadalang_available === true;
  setTimeout(() => { backendAvailable = null; }, 30_000);
  return backendAvailable;
}

/**
 * Convert backend subprogram_index entries into Subprogram[] for the store.
 * Uses the richer libadalang data (accurate line numbers, parameter strings, return types).
 */
function backendSubprogramsToStore(
  analysis: AdaAnalysisResult,
  fileId: string
): Subprogram[] {
  const filePath = analysis.file_paths?.[0] ?? '';
  // Try exact path match first, then any key
  const entries =
    analysis.subprogram_index?.[filePath] ??
    Object.values(analysis.subprogram_index ?? {})[0] ??
    [];

  return entries.map((s) => {
    const params = (s.parameters ?? []).map((p: string) => {
      const parts = p.split(':').map((x) => x.trim());
      const namePart = parts[0] ?? 'param';
      const typePart = parts.slice(1).join(':').trim();
      const modeMatch = /^(in\s+out|in|out)\s+(.+)$/i.exec(typePart);
      return {
        name: namePart,
        paramType: modeMatch ? modeMatch[2].trim() : typePart || 'Unknown',
        mode: (modeMatch ? modeMatch[1].toLowerCase().replace(/\s+/, ' ').trim() : 'in') as 'in' | 'out' | 'in out',
      };
    });

    return {
      id: `${fileId}_${s.name}_${s.start_line}`,
      fileId,
      name: s.name,
      kind: (s.return_type ? 'function' : 'procedure') as 'function' | 'procedure',
      parameters: params,
      returnType: s.return_type ?? undefined,
      startLine: s.start_line,
      endLine: s.end_line,
      testCount: 0,
    };
  });
}

export function useFileParser() {
  const { updateFileStatus } = useFileStore();
  const { setSubprograms, subprograms } = useSubprogramStore();
  const { setResult, syncToFile } = useParseStore();
  const subprogramsRef = useRef(subprograms);
  subprogramsRef.current = subprograms;
  // Track files currently being parsed to avoid duplicate calls
  const parsingIds = useRef<Set<string>>(new Set());

  const parseFile = useCallback(async (file: AdaFile) => {
    // Prevent duplicate concurrent parses of the same file
    if (parsingIds.current.has(file.id)) return;
    parsingIds.current.add(file.id);

    updateFileStatus(file.id, 'parsing');

    try {
      const useBackend = await isBackendAvailable();

      if (useBackend) {
        // ── Backend (libadalang) path ────────────────────────────────────────
        try {
          const analysisResult = await analyzeFiles([{ name: file.name, content: file.content }]);

          // Use richer subprogram data from backend subprogram_index
          const subs = backendSubprogramsToStore(analysisResult, file.id);
          // Fall back to client-side parser if backend returned no subprograms
          const finalSubs = subs.length > 0 ? subs : parseSubprograms(file.content, file.id);

          setResult(file.id, {
            fileId: file.id,
            fileName: file.name,
            parsedAt: new Date().toISOString(),
            subprograms: finalSubs,
            analysis: analysisResult,
            jsonText: JSON.stringify(analysisResult, null, 2),
          });

          syncToFile(file.id);
          updateFileStatus(file.id, 'parsed');

          // Merge subprograms into store
          const kept = subprogramsRef.current.filter((s) => s.fileId !== file.id);
          setSubprograms([...kept, ...finalSubs]);
          return;
        } catch (backendErr) {
          console.warn('[useFileParser] Backend failed, falling back:', backendErr);
          backendAvailable = false;
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

      const kept = subprogramsRef.current.filter((s) => s.fileId !== file.id);
      setSubprograms([...kept, ...subs]);

    } catch (err) {
      updateFileStatus(
        file.id,
        'error',
        err instanceof Error ? err.message : 'Parse error'
      );
    } finally {
      parsingIds.current.delete(file.id);
    }
  }, [updateFileStatus, setResult, syncToFile, setSubprograms]);

  return { parseFile };
}
