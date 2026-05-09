/**
 * Session persistence — saves uploaded files + folders to localStorage
 * so they survive page refresh. Uses a compact format to stay within quota.
 */
import { AdaFile, AdaFolder } from '../types/file.types';

const SESSION_KEY = 'ada_session_v1';
const MAX_FILE_SIZE = 200_000; // 200 KB per file — skip larger ones

interface SessionData {
  files: AdaFile[];
  folders: AdaFolder[];
  activeFileId: string | null;
  savedAt: string;
}

export function saveSession(files: AdaFile[], folders: AdaFolder[], activeFileId: string | null) {
  try {
    const compactFiles = files.map((f) => ({
      ...f,
      // Truncate very large files to avoid quota errors
      content: f.content.length > MAX_FILE_SIZE
        ? f.content.slice(0, MAX_FILE_SIZE) + '\n-- [truncated for storage]'
        : f.content,
    }));
    const data: SessionData = { files: compactFiles, folders, activeFileId, savedAt: new Date().toISOString() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded — clear old session and try once more with just metadata
    try {
      localStorage.removeItem(SESSION_KEY);
      const minimal: SessionData = {
        files: files.map((f) => ({ ...f, content: '' })),
        folders,
        activeFileId,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(minimal));
    } catch {
      // Give up silently
    }
  }
}

export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
