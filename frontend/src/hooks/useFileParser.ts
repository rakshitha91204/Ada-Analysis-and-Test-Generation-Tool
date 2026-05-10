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
import { analyzeAdaSource } from '../utils/adaAnalyzer';
import { analyzeFiles, checkHealth } from '../utils/apiClient';
import type { AdaFile } from '../types/file.types';

// Cache backend availability — re-check every 30 s
let backendAvailable: boolean | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  const health = await checkHealth();
  backendAvailable = health !== null && health.libadalang_available === true;
  setTimeout(() => { backendAvailable = null; }, 30_000);
  return backendAvailable;
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
          const subs = parseSubprograms(file.content, file.id);

          setResult(file.id, {
            fileId: file.id,
            fileName: file.name,
            parsedAt: new Date().toISOString(),
            subprograms: subs,
            analysis: analysisResult,
            jsonText: JSON.stringify(analysisResult, null, 2),
          });

          syncToFile(file.id);
          updateFileStatus(file.id, 'parsed');

          // Merge subprograms
          const kept = subprogramsRef.current.filter((s) => s.fileId !== file.id);
          setSubprograms([...kept, ...subs]);
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
