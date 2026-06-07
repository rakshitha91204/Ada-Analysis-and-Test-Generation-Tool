/**
 * useStreamingAnalysis.ts
 * Connects to POST /analyze/stream (SSE) and surfaces per-stage
 * progress plus the final merged result.
 */
import { useState, useCallback, useRef } from 'react';

export interface StageState {
  key:     string;
  label:   string;
  status:  'idle' | 'running' | 'done' | 'error';
  result?: unknown;
  detail?: string;
}

interface StreamEvent {
  stage:    string;
  status:   'running' | 'done' | 'error';
  result:   unknown;
  progress: number;
  detail:   string;
}

const STAGE_LABELS: Record<string, string> = {
  load: 'Loading Ada units', subprograms: 'Indexing subprograms',
  ast: 'Extracting AST', callgraph: 'Building call graph',
  deadcode: 'Detecting dead code', complexity: 'Cyclomatic complexity',
  controlflow: 'Control flow analysis', loops: 'Loop analysis',
  variables: 'Extracting variables', globals: 'Global read/write',
  exceptions: 'Exception scanning', concurrency: 'Concurrency check',
  protected: 'Protected objects', logical: 'Logical errors',
  bugs: 'Bug detection', performance: 'Performance analysis',
  harness: 'Test harness gen', mocks: 'Mock stub gen',
  complete: 'Complete',
};

export function useStreamingAnalysis(apiBase = '') {
  const [stages,    setStages]    = useState<StageState[]>([]);
  const [progress,  setProgress]  = useState(0);
  const [result,    setResult]    = useState<Record<string, unknown> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStages([]); setProgress(0); setResult(null); setError(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const start = useCallback(async (files: File[]) => {
    reset();
    setIsRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const form = new FormData();
    files.forEach((f) => form.append('files', f));

    let response: Response;
    try {
      response = await fetch(`${apiBase}/analyze/stream`, {
        method: 'POST', body: form, signal: ctrl.signal,
      });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Network error');
      setIsRunning(false);
      return;
    }

    if (!response.ok || !response.body) {
      setError(`Server error ${response.status}`);
      setIsRunning(false);
      return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let evt: StreamEvent;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }

          setProgress(evt.progress ?? 0);

          if (evt.stage === 'complete') {
            setResult(evt.result as Record<string, unknown>);
            setIsRunning(false);
            continue;
          }

          const label = STAGE_LABELS[evt.stage] ?? evt.stage;
          setStages((prev) => {
            const idx = prev.findIndex((s) => s.key === evt.stage);
            const entry: StageState = {
              key: evt.stage, label,
              status: evt.status === 'done' ? 'done' : evt.status === 'error' ? 'error' : 'running',
              result: evt.result ?? undefined,
              detail: evt.detail,
            };
            if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n; }
            return [...prev, entry];
          });
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message ?? 'Stream error');
    } finally {
      setIsRunning(false);
    }
  }, [apiBase, reset]);

  return { start, abort, stages, progress, result, isRunning, error, reset };
}
