import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GitBranch, Copy } from 'lucide-react';
import { GraphControls } from './GraphControls';
import { EmptyState } from '../shared/EmptyState';
import { useSubprogramStore } from '../../store/useSubprogramStore';
import { useParseStore } from '../../store/useParseStore';
import { useFileStore } from '../../store/useFileStore';
import { generateDOT } from '../../utils/dotGenerator';
import { mockCallGraph } from '../../mocks/mockCallGraph';
import { CallGraph } from '../../types/graph.types';

/**
 * Convert the backend call_graph format:
 *   { "SubName": ["Callee1", "Callee2"], ... }
 * into the CallGraph { nodes, edges } format used by generateDOT.
 */
function backendCallGraphToCallGraph(
  callGraph: Record<string, string[]>,
  subprogramIndex: Record<string, { name: string; return_type: string | null }[]>
): CallGraph {
  // Build a set of all known subprogram names and their kinds
  const kindMap = new Map<string, 'procedure' | 'function'>();
  for (const subs of Object.values(subprogramIndex)) {
    for (const sub of subs) {
      kindMap.set(sub.name, sub.return_type ? 'function' : 'procedure');
    }
  }

  const nodeIds = new Set<string>();
  const edges: CallGraph['edges'] = [];

  for (const [caller, callees] of Object.entries(callGraph)) {
    nodeIds.add(caller);
    for (const callee of callees) {
      nodeIds.add(callee);
      edges.push({ from: caller, to: callee });
    }
  }

  const nodes: CallGraph['nodes'] = Array.from(nodeIds).map((name) => ({
    id: name,
    label: name,
    kind: kindMap.get(name) ?? 'procedure',
  }));

  return { nodes, edges };
}

export const GraphViewer: React.FC = () => {
  const { selectedSubprogramId, subprograms } = useSubprogramStore();
  const { results, activeResultFileId } = useParseStore();
  const { activeFileId } = useFileStore();

  const [svgContent, setSvgContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dotSource, setDotSource] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Resolve the call graph: prefer real backend data, fall back to mock
  const activeResult = activeResultFileId
    ? results[activeResultFileId]
    : activeFileId
    ? results[activeFileId]
    : null;

  const callGraph: CallGraph = (() => {
    if (activeResult?.analysis?.call_graph) {
      const cg = activeResult.analysis.call_graph;
      const si = activeResult.analysis.subprogram_index ?? {};
      // Flatten subprogram_index values for kind lookup
      const flatSI: Record<string, { name: string; return_type: string | null }[]> = {};
      for (const [file, subs] of Object.entries(si)) {
        flatSI[file] = subs as { name: string; return_type: string | null }[];
      }
      const converted = backendCallGraphToCallGraph(cg, flatSI);
      // Only use backend graph if it has nodes
      if (converted.nodes.length > 0) return converted;
    }
    return mockCallGraph;
  })();

  // Highlight the selected subprogram node
  const highlightId = selectedSubprogramId
    ? (subprograms.find((s) => s.id === selectedSubprogramId)?.name ?? selectedSubprogramId)
    : undefined;

  const renderGraph = useCallback(async (dot: string) => {
    setLoading(true);
    setError(null);
    try {
      const { Graphviz } = await import('@hpcc-js/wasm');
      const graphviz = await Graphviz.load();
      const svg = graphviz.dot(dot);
      setSvgContent(svg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render graph');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const dot = generateDOT(callGraph, highlightId);
    setDotSource(dot);
    renderGraph(dot);
  }, [activeResultFileId, activeFileId, selectedSubprogramId, renderGraph]); // eslint-disable-line

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.2, Math.min(4, s - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { dragging.current = false; }, []);

  const handleCopyDot = () => {
    navigator.clipboard.writeText(dotSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Source badge */}
      {activeResult?.analysis?.call_graph && (
        <div
          className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[9px] font-mono"
          style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}
        >
          libadalang ✓
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full spin" />
            <p className="text-xs font-mono text-zinc-500">Rendering graph...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-sm text-red-400 font-mono">Graph render failed: {error}</p>
          <div className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-mono text-zinc-500">Raw DOT source:</p>
              <button
                onClick={handleCopyDot}
                className="flex items-center gap-1 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Copy size={11} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 rounded p-3 overflow-auto max-h-64">
              {dotSource}
            </pre>
          </div>
        </div>
      )}

      {!loading && !error && !svgContent && (
        <EmptyState
          icon={<GitBranch size={28} />}
          heading="No graph to display"
          subtext="Click a file to parse it — the call graph will appear here."
        />
      )}

      {!loading && !error && svgContent && (
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing graph-fade-in"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ userSelect: 'none' }}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      )}

      <GraphControls
        scale={scale}
        onZoomIn={() => setScale((s) => Math.min(4, s + 0.2))}
        onZoomOut={() => setScale((s) => Math.max(0.2, s - 0.2))}
        onReset={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
      />
    </div>
  );
};
