import { useEffect } from 'react';
import { useFileStore } from '../store/useFileStore';
import { useSubprogramStore } from '../store/useSubprogramStore';
import { parseSubprograms } from '../utils/adaParser';

export function useFileParser() {
  const { files, updateFileStatus } = useFileStore();
  const { addSubprograms } = useSubprogramStore();

  useEffect(() => {
    const pendingFiles = files.filter((f) => f.status === 'pending');

    for (const file of pendingFiles) {
      updateFileStatus(file.id, 'parsing');

      // Run parsing asynchronously
      setTimeout(() => {
        try {
          const subs = parseSubprograms(file.content, file.id);
          addSubprograms(subs);
          updateFileStatus(file.id, 'parsed');
        } catch (err) {
          updateFileStatus(
            file.id,
            'error',
            err instanceof Error ? err.message : 'Parse error'
          );
        }
      }, 100);
    }
  }, [files, updateFileStatus, addSubprograms]);
}
