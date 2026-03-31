import { CallGraph } from '../types/graph.types';

export function generateDOT(graph: CallGraph, highlightedId?: string): string {
  const nodeLines = graph.nodes.map((node) => {
    const isHighlighted = node.id === highlightedId;
    const fillColor = isHighlighted ? '#f59e0b' : '#1e1e24';
    const fontColor = isHighlighted ? '#0e0e10' : '#f4f4f5';
    const borderColor = isHighlighted ? '#f59e0b' : '#52525b';
    const shape = node.kind === 'function' ? 'ellipse' : 'box';

    return `  "${node.id}" [
    label="${node.label}",
    shape=${shape},
    style="filled,rounded",
    fillcolor="${fillColor}",
    fontcolor="${fontColor}",
    color="${borderColor}",
    fontname="JetBrains Mono",
    fontsize=11,
    margin="0.2,0.1"
  ];`;
  });

  const edgeLines = graph.edges.map((edge) => {
    return `  "${edge.from}" -> "${edge.to}" [color="#52525b", arrowsize=0.8, penwidth=1.2];`;
  });

  return `digraph CallGraph {
  rankdir=LR;
  bgcolor="#0e0e10";
  pad=0.5;
  nodesep=0.6;
  ranksep=1.0;
  graph [fontname="JetBrains Mono", fontcolor="#a1a1aa"];
  node [fontname="JetBrains Mono"];
  edge [fontname="JetBrains Mono"];

${nodeLines.join('\n\n')}

${edgeLines.join('\n')}
}`;
}
