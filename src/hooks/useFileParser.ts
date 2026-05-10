/**
 * useFileParser.ts
 * ================
 * Parses Ada files when they enter "pending" status.
 *
 * Strategy (with graceful fallback):
 *   1. Try the Python FastAPI backend (/api/analyze).
 *      If it responds, use the rich libadalang-powered analysis.
 *   2. If the backend is unavailable (network error, 503, etc.),
 *      fall back to the client-side TypeScript analyzer so the UI
 *      always works even without the backend running.
 *
 * The result is stored in useParseStore keyed by fileId.
 */

import { useEffect, useRef } from 'react';
import { useFileStore } from '../store/useFileStore';
import { useSubprogramStore } from '../store/useSubprogramStore';
import { useParseStore } from '../store/useParseStore';
import { parseSubprograms } from '../utils/adaParser';
import { analyzeAdaSource } from '../utils/adaAnalyzer';
import { analyzeFiles, checkHealth } from '../utils/apiClient';
import type { AdaFile } from '../types/file.types';

// Cache the backend availability so we don't ping on every parse
let backendAvailable: boolean | null = null;

async function isBackendAvailable(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  const health = await checkHealth();
  backendAvailable = health !== null && health.libadalang_available === true;
  // Re-check after 30 s so a late-starting server is picked up
  setTimeout(() => { backendAvailable = null; }, 30_000);
  return backendAvailable;
}

export function useFileParser() {
  const { files, updateFileStatus } = useFileStore();
  const { setSubprograms, subprograms } = useSubprogramStore();
  const { setResult, syncToFile, activeResultFileId } = useParseStore();
  const parsedIds = useRef<Set<string>>(new Set());
  const subprogramsRef = useRef(subprograms);
  subprogramsRef.current = subprograms;
  const activeResultFileIdRef = useRef(activeResultFileId);
  activeResultFileIdRef.current = activeResultFileId;

  useEffect(() => {
    const pendingFiles = files.filter(
      (f) => f.status === 'pending' && !parsedIds.current.has(f.id)
    );
    if (pendingFiles.length === 0) return;

    // Mark all pending immediately to prevent duplicate triggers
    for (const file of pendingFiles) {
      updateFileStatus(file.id, 'parsing');
      parsedIds.current.add(file.id);
    }

    // Run async parse in the background
    void parseAll(pendingFiles);

    async function parseAll(batch: AdaFile[]) {
      const useBackend = await isBackendAvailable();
      const allNewSubs: ReturnType<typeof parseSubprograms> = [];

      if (useBackend) {
        // ── Backend path ────────────────────────────────────────────────────
        try {
          const backendFiles = batch.map((f) => ({ name: f.name, content: f.content }));
          const analysisResult = await analyzeFiles(backendFiles);

          for (const file of batch) {
            try {
              const subs = parseSubprograms(file.content, file.id);
              allNewSubs.push(...subs);

              // Store the backend analysis result in the parse store
              setResult(file.id, {
                fileId: file.id,
                fileName: file.name,
                parsedAt: new Date().toISOString(),
                subprograms: subs,
                analysis: analysisResult,
                jsonText: JSON.stringify(analysisResult, null, 2),
              });

              // Auto-activate this file's result if it's the currently active file
              // or if no result is active yet
              if (!activeResultFileIdRef.current || activeResultFileIdRef.current === file.id) {
                syncToFile(file.id);
              }

              updateFileStatus(file.id, 'parsed');
            } catch (err) {
              updateFileStatus(
                file.id,
                'error',
                err instanceof Error ? err.message : 'Parse error'
              );
            }
          }
        } catch (backendErr) {
          // Backend call failed — fall through to client-side analysis
          console.warn('[useFileParser] Backend analysis failed, falling back to client-side:', backendErr);
          backendAvailable = false;
          await parseClientSide(batch, allNewSubs);
        }
      } else {
        // ── Client-side fallback ────────────────────────────────────────────
        await parseClientSide(batch, allNewSubs);
      }

      // Merge newly parsed subprograms into the store
      const batchFileIds = new Set(batch.map((f) => f.id));
      const kept = subprogramsRef.current.filter((s) => !batchFileIds.has(s.fileId));
      setSubprograms([...kept, ...allNewSubs]);
    }

    async function parseClientSide(
      batch: AdaFile[],
      allNewSubs: ReturnType<typeof parseSubprograms>
    ) {
      for (const file of batch) {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            try {
              const fileType = file.name.endsWith('.ads') ? 'spec' : 'body';
              const subs = parseSubprograms(file.content, file.id);
              allNewSubs.push(...subs);

              const analysis = analyzeAdaSource(file.content, file.name, fileType);

              setResult(file.id, {
                fileId: file.id,
                fileName: file.name,
                parsedAt: new Date().toISOString(),
                subprograms: subs,
                analysis,
                jsonText: JSON.stringify(analysis, null, 2),
              });

              // Auto-activate this file's result if it's the currently active file
              // or if no result is active yet
              if (!activeResultFileIdRef.current || activeResultFileIdRef.current === file.id) {
                syncToFile(file.id);
              }

              updateFileStatus(file.id, 'parsed');
            } catch (err) {
              updateFileStatus(
                file.id,
                'error',
                err instanceof Error ? err.message : 'Parse error'
              );
            }
            resolve();
          }, 80);
        });
      }
    }
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps
}
