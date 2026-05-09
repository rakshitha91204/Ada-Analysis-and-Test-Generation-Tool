# Ada Analysis Tool — Frontend

React 18 + TypeScript + Vite web IDE for Ada source code analysis and test generation.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

> The editor loads with demo Ada calculator code automatically — no backend required for basic use.

## Requirements

- Node.js 18+
- Backend server running on `http://localhost:8001` for full libadalang analysis (optional — falls back to client-side analysis)

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Editor | Monaco Editor |
| State Management | Zustand |
| Graph Rendering | `@hpcc-js/wasm` (Graphviz DOT) |
| File Upload | react-dropzone |
| Styling | Tailwind CSS |
| Icons | Lucide React |

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── editor/          # Monaco editor, tabs, breadcrumbs, Ada syntax
│   │   ├── file-manager/    # File tree, package hierarchy, JSON panel
│   │   ├── subprogram/      # Outline explorer, context menu, parameters modal
│   │   ├── test-cases/      # Test panel, cards, history, runner, coverage heatmap
│   │   ├── graph/           # Graphviz call graph viewer
│   │   ├── diagnostics/     # Diagnostics panel
│   │   ├── analysis/        # Static analysis output
│   │   ├── panels/          # Resizable right/bottom panels
│   │   ├── upload/          # Dropzone, file/folder preview
│   │   └── shared/          # Badge, Button, Toast, Tooltip, CommandPalette
│   ├── hooks/               # useFileParser, useResizablePanel, useKeyboardShortcuts
│   ├── mocks/               # Demo Ada files, subprograms, test cases
│   ├── pages/               # UploadPage, EditorPage
│   ├── store/               # Zustand stores (file, editor, subprogram, test, settings)
│   ├── types/               # TypeScript interfaces
│   └── utils/
│       ├── adaParser.ts     # Regex-based Ada parser
│       ├── adaAnalyzer.ts   # Client-side analysis (fallback)
│       ├── apiClient.ts     # Backend API client (fetch wrapper)
│       ├── testCaseGenerator.ts
│       ├── dotGenerator.ts
│       └── reportExport.ts
├── index.html
├── vite.config.ts           # Proxy: /api → http://localhost:8001
├── tailwind.config.ts
└── package.json
```

## Backend Integration

The frontend proxies `/api/*` to the backend via Vite's dev server proxy (configured in `vite.config.ts`).

When the backend is running:
- Files are sent to `POST /api/analyze` using multipart form-data
- The full libadalang-powered analysis result is returned and stored in `useParseStore`

When the backend is **not** running:
- The frontend falls back to `adaAnalyzer.ts` (regex-based TypeScript analysis)
- All UI features remain functional

## Available Scripts

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build
```
