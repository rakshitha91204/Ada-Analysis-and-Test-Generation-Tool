# Ada Analysis & Test Generation Tool — Frontend

A production-grade web-based IDE frontend for Ada source code analysis and automatic test case generation. Built with React 18, TypeScript, Monaco Editor, and Vite.

---

## Getting Started

```bash
git clone https://github.com/Banarji03/ada-analysis-tool.git
cd ada-analysis-tool
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — the editor loads with demo Ada calculator code automatically. No backend required.

**Requirements:** Node.js 18+

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| State | Zustand |
| Graph Rendering | `@hpcc-js/wasm` (Graphviz DOT) |
| File Upload | react-dropzone |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Dates | date-fns |

---

## Features

### Upload Page
- Drag & drop `.adb` / `.ads` files or click to browse
- Upload entire folders — scans recursively for Ada files, warns if >30 files
- Folder preview cards with collapsible file list
- Duplicate detection with replace option
- Analysis settings toggle (test gen, static analysis, minimap, split editor, font size, theme)
- Session persistence — files survive page refresh via localStorage

### Editor — Code View
- Monaco Editor with custom Ada syntax highlighting (`ada-purple` theme by default)
- Three themes: Purple (VS Code-like), Amber (dark), Soft (warm dark)
- Sticky subprogram header — shows which subprogram your cursor is inside
- Inline error squiggles from diagnostics (Monaco `setModelMarkers`)
- Gutter icons: ✓ pass / ✗ fail / ~ partial per subprogram
- Navigation flash animation when jumping to a line
- Split editor pane — view two files side by side
- Find & Replace (`Ctrl+H`)
- Hover tooltips — hover any subprogram name to see its signature and test count
- Go to definition — `Ctrl+Click` a subprogram name to jump to its definition
- Font size controls (`Ctrl++` / `Ctrl+-`)
- Minimap toggle (`Ctrl+M`)

### Subprogram Explorer (Outline Panel)
- Procedures / Functions tabs with count badges
- Instant search with match highlighting
- Click any row → navigates editor to that exact line with yellow flash
- Complexity dot per row (green/yellow/red based on line count)
- Test count badge (`🧪3`) with pass/fail color coding
- Copy signature button on hover
- "No tests" filter — show only untested subprograms
- "Gen all" button — generate tests for all subprograms at once
- Cursor tracking — highlights which subprogram your cursor is currently inside
- Right-click context menu on every row

### Right-Click Context Menu
All 6 actions fully functional:
- **Generate Test Case** — auto-generates normal/edge/invalid tests, switches to Test Cases tab
- **View Variables** — switches to Analysis tab
- **Show Parameters** — opens a full modal with parameter details, mode badges, Ada signature, copy button
- **Coverage Report** — switches to Analysis tab
- **Call Graph** — switches to Call Graph tab
- **Dead Code Analysis** — switches to Analysis tab

### Package Hierarchy Panel
- Tree view of packages, with/use dependencies, tasks, exceptions, and subprograms
- Spec/body linking — click 🔗 to jump between `.ads` and `.adb`
- Right-click subprograms for the full context menu

### Test Cases
- Auto-generation on subprogram selection (normal, edge, invalid, boundary)
- Test count badge and pass/fail status per subprogram
- Drag-to-reorder test cards
- Inline note/annotation editor per test case
- Edit, clone, remove individual test cases
- Test history with localStorage persistence (up to 50 sets)
- Tag/rename history entries
- Coverage heatmap — shows which test types (normal/edge/invalid) are covered per subprogram
- Test statistics panel — total/pass/fail/pending counts with pass rate bar
- Export options: JSON, all history JSON, `.adb` stub, CSV

### Test Runner
- Run all tests with simulated async execution
- Pass/fail status with stagger animation
- Side-by-side diff view on failure (Expected vs Actual)
- Pass rate progress bar

### Analysis Output
- Unused variables list with file/line
- Dead code (unreachable blocks)
- Cyclomatic complexity per subprogram with color-coded bar
- Subprogram summary (total, procedures, functions, with tests)
- Last analysis timestamp

### Diagnostics Panel
- Error / Warning / Info rows with severity icons
- Click any row → navigates editor to that exact line
- Filter by All / Errors / Warnings

### Call Graph
- Graphviz DOT rendering via `@hpcc-js/wasm`
- Pan (drag) and zoom (scroll wheel)
- Zoom in/out/reset controls
- Highlighted node for selected subprogram

### Command Palette (`Ctrl+K`)
- Fuzzy search across files, subprograms, and actions
- Keyboard navigation (↑↓ Enter Esc)

### Other
- Keyboard shortcuts modal (`?` key)
- Onboarding tour for first-time users
- HTML report export (self-contained, printable to PDF)
- Project JSON export/import (`.adaproject.json`)
- Session persistence — uploaded files restored on refresh
- Resizable right panel and bottom panel (drag handles)
- Collapsible panels (`Ctrl+\` / `Ctrl+\``)

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command Palette |
| `Ctrl+Shift+T` | Switch to Test Cases tab |
| `Ctrl+Shift+G` | Switch to Call Graph tab |
| `Ctrl+Shift+P` | Focus subprogram search |
| `Ctrl+E` | Export current tests as JSON |
| `Ctrl+H` | Find & Replace in editor |
| `Ctrl+M` | Toggle minimap |
| `Ctrl++` / `Ctrl+-` | Increase / decrease font size |
| `Ctrl+\` | Toggle right panel |
| `Ctrl+\`` | Toggle bottom panel |
| `?` | Keyboard shortcuts modal |
| `Esc` | Close modal / context menu |

---

## Project Structure

```
src/
├── components/
│   ├── editor/          # Monaco editor, tabs, breadcrumbs, Ada language definition
│   ├── file-manager/    # File tree, folder groups, package hierarchy
│   ├── subprogram/      # Outline explorer, context menu, parameters modal
│   ├── test-cases/      # Test panel, cards, editor, history, runner, coverage heatmap
│   ├── graph/           # Graphviz call graph viewer + controls
│   ├── diagnostics/     # Diagnostics panel with click-to-navigate
│   ├── analysis/        # Static analysis output
│   ├── panels/          # Resizable right/bottom panels
│   ├── upload/          # Dropzone, file/folder preview cards, settings
│   └── shared/          # Badge, Button, Toast, Tooltip, CommandPalette, OnboardingTour, etc.
├── hooks/               # useResizablePanel, useKeyboardShortcuts, useFileParser, etc.
├── mocks/               # Demo Ada files, subprograms, test cases, diagnostics
├── pages/               # UploadPage, EditorPage
├── store/               # Zustand stores (file, editor, subprogram, test, settings)
├── types/               # TypeScript interfaces
└── utils/               # adaParser, testCaseGenerator, dotGenerator, exportUtils, reportExport
```

---

## Architecture Note

This is a **frontend-only** project. All parsing, analysis, and test execution are simulated:

- Ada parsing uses regex (`adaParser.ts`) — detects procedures, functions, packages, tasks, exceptions, with/use clauses
- Static analysis uses mock diagnostics
- Test execution is simulated with `setTimeout`
- Call graph uses mock data

A real backend (Python FastAPI + Libadalang + gnatcheck + gnatmake) can be connected by replacing the mock utilities with `fetch()` calls to API endpoints. The data shapes (`AdaFile`, `Subprogram`, `TestCase`, `CallGraph`, `Diagnostic`) are already defined and ready.
