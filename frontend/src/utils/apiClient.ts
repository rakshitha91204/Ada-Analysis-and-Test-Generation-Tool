/**
 * apiClient.ts
 * ============
 * Thin wrapper around the Python FastAPI backend.
 *
 * The Vite dev-server proxies /api → http://localhost:8001, so all
 * fetch calls use relative URLs and work without CORS issues in dev.
 * In production, point VITE_API_BASE_URL at the deployed server.
 */

import { AdaAnalysisResult } from './adaAnalyzer';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BackendFile {
  name: string;
  content: string;
}

export interface HealthResponse {
  status: string;
  libadalang_available: boolean;
}

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Ping the backend. Returns null if the server is unreachable.
 */
export async function checkHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

// ── Analysis ──────────────────────────────────────────────────────────────────

/**
 * Send one or more Ada source files to the backend for analysis.
 *
 * @param files  Array of { name, content } objects (in-memory Ada files).
 * @returns      The full AdaAnalysisResult from the backend.
 * @throws       Error with a descriptive message on failure.
 */
export async function analyzeFiles(files: BackendFile[]): Promise<AdaAnalysisResult> {
  if (files.length === 0) {
    throw new Error('No files provided for analysis.');
  }

  const formData = new FormData();
  for (const file of files) {
    const blob = new Blob([file.content], { type: 'text/plain' });
    formData.append('files', blob, file.name);
  }

  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`Backend analysis failed: ${detail}`);
  }

  return (await res.json()) as AdaAnalysisResult;
}

/**
 * Analyse a single Ada file by name + content.
 * Convenience wrapper around analyzeFiles().
 */
export async function analyzeSingleFile(
  name: string,
  content: string
): Promise<AdaAnalysisResult> {
  return analyzeFiles([{ name, content }]);
}
