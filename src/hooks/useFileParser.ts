import { useEffect, useRef } from 'react';
import { useFileStore } from '../store/useFileStore';
import { useSubprogramStore } from '../store/useSubprogramStore';
import { parseSubprograms } from '../utils/adaParser';

export function useFileParser() {
  const { files, updateFileStatus } = useFileStore();
  const { setSubprograms, subprograms } = useSubprogramStore();
  const parsedIds = useRef<Set<string>>(new Set());
  // Keep a stable ref to subprograms so the closure inside setTimeout is fresh
  const subprogramsRef = useRef(subprograms);
  subprogramsRef.current = subprograms;

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

    let completed = 0;
    const allNewSubs: ReturnType<typeof parseSubprograms> = [];

    for (const file of pendingFiles) {
      setTimeout(() => {
        try {
          const subs = parseSubprograms(file.content, file.id);
          allNewSubs.push(...subs);
          updateFileStatus(file.id, 'parsed');
        } catch (err) {
          updateFileStatus(
            file.id,
            'error',
            err instanceof Error ? err.message : 'Parse error'
          );
        }

        completed++;
        if (completed === pendingFiles.length) {
          // Keep subprograms from files NOT in this batch, add newly parsed ones
          const batchFileIds = new Set(pendingFiles.map((f) => f.id));
          const kept = subprogramsRef.current.filter((s) => !batchFileIds.has(s.fileId));
          setSubprograms([...kept, ...allNewSubs]);
        }
      }, 80);
    }
  }, [files]); // eslint-disable-line react-hooks/exhaustive-deps
}
