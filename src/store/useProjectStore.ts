/**
 * useProjectStore.ts
 * ==================
 * Manages named Ada projects. Each project stores:
 *   - name, createdAt, lastOpenedAt
 *   - the file/folder session (files, folders, activeFileId)
 *
 * Projects are persisted in localStorage under 'ada_projects_v1'.
 * The active project name is stored under 'ada_active_project'.
 */
import { create } from 'zustand';
import { AdaFile, AdaFolder } from '../types/file.types';

const PROJECTS_KEY  = 'ada_projects_v1';
const ACTIVE_KEY    = 'ada_active_project';

export interface ProjectMeta {
  name:         string;
  createdAt:    string;
  lastOpenedAt: string;
  fileCount:    number;
}

export interface ProjectData {
  name:         string;
  createdAt:    string;
  lastOpenedAt: string;
  files:        AdaFile[];
  folders:      AdaFolder[];
  activeFileId: string | null;
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function loadAllProjects(): Record<string, ProjectData> {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProjectData>) : {};
  } catch { return {}; }
}

function saveAllProjects(projects: Record<string, ProjectData>) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    // Quota exceeded — try trimming file content
    try {
      const trimmed = Object.fromEntries(
        Object.entries(projects).map(([k, v]) => [k, {
          ...v,
          files: v.files.map(f => ({ ...f, content: f.content.slice(0, 100_000) }))
        }])
      );
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(trimmed));
    } catch { /* give up */ }
  }
}

function loadActiveProjectName(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function saveActiveProjectName(name: string | null) {
  if (name) localStorage.setItem(ACTIVE_KEY, name);
  else localStorage.removeItem(ACTIVE_KEY);
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ProjectStore {
  /** All project metadata for the list view */
  projects: Record<string, ProjectData>;
  /** Name of the currently open project (null = no project selected) */
  activeProjectName: string | null;

  /** Create a new empty project and make it active */
  createProject: (name: string) => void;

  /** Open an existing project by name. Returns the project data. */
  openProject: (name: string) => ProjectData | null;

  /** Save the current state into the active project */
  saveProject: (files: AdaFile[], folders: AdaFolder[], activeFileId: string | null) => void;

  /** Delete a project */
  deleteProject: (name: string) => void;

  /** Rename a project */
  renameProject: (oldName: string, newName: string) => boolean;

  /** List of all projects sorted by lastOpenedAt (newest first) */
  projectList: () => ProjectMeta[];

  /** Check if a project name already exists */
  projectExists: (name: string) => boolean;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects:          loadAllProjects(),
  activeProjectName: loadActiveProjectName(),

  createProject: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const projects = get().projects;
    const now = new Date().toISOString();
    const newProject: ProjectData = {
      name:         trimmed,
      createdAt:    projects[trimmed]?.createdAt ?? now,
      lastOpenedAt: now,
      files:        [],
      folders:      [],
      activeFileId: null,
    };
    const updated = { ...projects, [trimmed]: newProject };
    saveAllProjects(updated);
    saveActiveProjectName(trimmed);
    set({ projects: updated, activeProjectName: trimmed });
  },

  openProject: (name) => {
    const projects = get().projects;
    const project = projects[name];
    if (!project) return null;
    const updated = {
      ...projects,
      [name]: { ...project, lastOpenedAt: new Date().toISOString() }
    };
    saveAllProjects(updated);
    saveActiveProjectName(name);
    set({ projects: updated, activeProjectName: name });
    return updated[name];
  },

  saveProject: (files, folders, activeFileId) => {
    const name = get().activeProjectName;
    if (!name) return;
    const projects = get().projects;
    const existing = projects[name];
    const updated = {
      ...projects,
      [name]: {
        ...existing,
        name,
        files,
        folders,
        activeFileId,
        lastOpenedAt: new Date().toISOString(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }
    };
    saveAllProjects(updated);
    set({ projects: updated });
  },

  deleteProject: (name) => {
    const projects = { ...get().projects };
    delete projects[name];
    saveAllProjects(projects);
    const activeProjectName = get().activeProjectName === name ? null : get().activeProjectName;
    saveActiveProjectName(activeProjectName);
    set({ projects, activeProjectName });
  },

  renameProject: (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return false;
    const projects = get().projects;
    if (projects[trimmed]) return false; // name already taken
    const project = { ...projects[oldName], name: trimmed };
    const updated = { ...projects, [trimmed]: project };
    delete updated[oldName];
    saveAllProjects(updated);
    const activeProjectName = get().activeProjectName === oldName ? trimmed : get().activeProjectName;
    saveActiveProjectName(activeProjectName);
    set({ projects: updated, activeProjectName });
    return true;
  },

  projectList: () => {
    return Object.values(get().projects)
      .map(p => ({
        name:         p.name,
        createdAt:    p.createdAt,
        lastOpenedAt: p.lastOpenedAt,
        fileCount:    p.files?.length ?? 0,
      }))
      .sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime());
  },

  projectExists: (name) => !!get().projects[name.trim()],
}));
