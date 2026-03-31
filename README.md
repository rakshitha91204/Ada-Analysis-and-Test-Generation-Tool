# Ada Analysis & Test Generation Tool — Frontend

A production-grade web-based IDE frontend for Ada source code analysis and automatic test case generation.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — build tool
- **Monaco Editor** — code editor with custom Ada syntax highlighting
- **Zustand** — global state management
- **Tailwind CSS** — styling
- **@hpcc-js/wasm** — Graphviz DOT rendering for call graphs
- **react-dropzone** — file/folder uploads
- **Lucide React** — icons
- **date-fns** — timestamps

## Features

- Upload `.adb` / `.ads` files or entire folders
- Monaco editor with custom Ada dark theme, syntax highlighting, find & replace
- Subprogram explorer with search, context menu, and right-click actions
- Auto test case generation (normal / edge / invalid) with coverage heatmap
- Test history with localStorage persistence, tagging, and export
- Call graph visualization via Graphviz DOT
- Static analysis panel (unused variables, dead code, cyclomatic complexity)
- Test runner with simulated execution and side-by-side diff on failure
- Command palette (`Ctrl+K`), keyboard shortcuts modal (`?`)
- Split editor pane, font size controls, minimap toggle, theme switcher
- Resizable panels (right + bottom), collapsible sections
- CSV / JSON / `.adb` stub export

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Project Structure

```
src/
├── components/
│   ├── editor/          # Monaco editor, tabs, breadcrumbs, Ada language def
│   ├── file-manager/    # File tree with folder support
│   ├── subprogram/      # Subprogram explorer, search, context menu
│   ├── test-cases/      # Test panel, cards, editor, history, runner, coverage
│   ├── graph/           # Graphviz call graph viewer + controls
│   ├── diagnostics/     # Diagnostics panel
│   ├── analysis/        # Static analysis output
│   ├── panels/          # Resizable right/bottom panels
│   ├── upload/          # Dropzone, file/folder preview cards, settings
│   └── shared/          # Badge, Button, Toast, Tooltip, CommandPalette, etc.
├── hooks/               # useResizablePanel, useKeyboardShortcuts, etc.
├── mocks/               # Mock Ada files, subprograms, test cases, diagnostics
├── pages/               # UploadPage, EditorPage
├── store/               # Zustand stores (file, editor, subprogram, test, settings)
├── types/               # TypeScript interfaces
└── utils/               # adaParser, testCaseGenerator, dotGenerator, exportUtils
```

## Note

This is a **frontend-only** project. All parsing, analysis, and test execution are currently simulated with mock data. A real backend (Python FastAPI + Libadalang + gnatcheck) can be connected by replacing the mock utilities with API calls.
