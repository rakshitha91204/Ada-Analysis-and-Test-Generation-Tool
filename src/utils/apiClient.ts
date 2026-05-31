/**
 * apiClient.ts
 * ============
 * Thin wrapper around the Python FastAPI backend.
 *
 * The Vite dev-server proxies /api → http://localhost:8001, so all
 * fetch calls use relative URLs and work without CORS issues in dev.
 * In production, point VITE_API_BASE_URL at the deployed server.
 */

/// <reference types="vite/client" />

import { AdaAnalysisResult } from './adaAnalyzer';

// Root-level endpoints: POST /analyze (file upload), GET /health
// These are proxied by Vite as-is (no /api prefix).
const ROOT_URL = (import.meta.env.VITE_API_ROOT_URL as string | undefined) ?? '';

// /api/* endpoints: test studio (files, subprograms, test/run, etc.)
// Vite proxies /api/* → http://localhost:8001/api/*
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
 * Hits GET /health (root-level, not /api/health).
 */
export async function checkHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${ROOT_URL}/health`, { signal: AbortSignal.timeout(3000) });
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

  const res = await fetch(`${ROOT_URL}/analyze`, {
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

// ── Test Studio API ───────────────────────────────────────────────────────────

export interface AdaFileEntry {
  path: string;
  name: string;
  ext: string;
  size: number;
}

export interface TypeConstraint {
  kind: 'integer' | 'float' | 'boolean' | 'character' | 'string' | 'unknown';
  min?: number;
  max?: number;
  values?: string[];
}

export interface SubprogramParam {
  name: string;
  dir: 'in' | 'out' | 'in out';
  type: string;
  type_normalized: string;
  constraint: TypeConstraint;
}

export interface SubprogramVariable {
  name: string;
  type: string;
  type_normalized: string;
  scope: 'local' | 'global' | 'constant';
  constraint: TypeConstraint;
}

export interface EnrichedSubprogram {
  name: string;
  file: string;
  file_name: string;
  start_line: number | null;
  end_line: number | null;
  return_type: string | null;
  params: SubprogramParam[];
  variables: SubprogramVariable[];
  complexity: number | null;
  is_dead: boolean;
  calls: string[];
}

export interface TestRunResult {
  test_id?: string;
  id?: string;
  subprogram: string;
  status: 'pass' | 'fail' | 'error';
  message: string;
  actual: Record<string, string>;
  elapsed_ms: number;
  violations?: Array<{ variable: string; type: string; value: string; error: string }>;
  normalized_types?: Record<string, string>;
  inputs: Record<string, string>;
  expected: Record<string, string>;
  timestamp?: string;
}

export interface AnalyzePathResult {
  ok: boolean;
  path?: string;
  file_count: number;
  subprogram_count: number;
  error?: string;
}

/**
 * Analyze an Ada project by filesystem path (Test Studio).
 */
export async function analyzeByPath(path: string): Promise<AnalyzePathResult> {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return (await res.json()) as AnalyzePathResult;
}

/**
 * List all Ada files from the last analysis session.
 */
export async function getFiles(): Promise<AdaFileEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/files`);
    if (!res.ok) return [];
    return (await res.json()) as AdaFileEntry[];
  } catch {
    return [];
  }
}

/**
 * Get enriched subprograms with type constraints.
 */
export async function getSubprograms(): Promise<EnrichedSubprogram[]> {
  try {
    const res = await fetch(`${BASE_URL}/subprograms`);
    if (!res.ok) return [];
    return (await res.json()) as EnrichedSubprogram[];
  } catch {
    return [];
  }
}

/**
 * Run a single test case against a subprogram.
 */
export async function runTest(
  subprogram: string,
  inputs: Record<string, string>,
  expected: Record<string, string>
): Promise<TestRunResult> {
  const res = await fetch(`${BASE_URL}/test/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subprogram, inputs, expected }),
  });
  return (await res.json()) as TestRunResult;
}

/**
 * Get all test results for this session.
 */
export async function getTestResults(subprogram?: string): Promise<TestRunResult[]> {
  try {
    const url = subprogram
      ? `${BASE_URL}/test/results?subprogram=${encodeURIComponent(subprogram)}`
      : `${BASE_URL}/test/results`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as TestRunResult[];
  } catch {
    return [];
  }
}

/**
 * Clear all test results for this session.
 */
export async function clearTestResults(): Promise<void> {
  await fetch(`${BASE_URL}/test/clear`, { method: 'POST' });
}

/**
 * Export full analysis + test results as JSON.
 * Returns the export URL (open in new tab or trigger download).
 */
export function getExportUrl(): string {
  return `${BASE_URL}/export`;
}
