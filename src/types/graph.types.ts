export interface CallGraphNode {
  id: string;
  label: string;
  kind: 'procedure' | 'function';
  highlighted?: boolean;
}

export interface CallGraphEdge {
  from: string;
  to: string;
}

export interface CallGraph {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
}
