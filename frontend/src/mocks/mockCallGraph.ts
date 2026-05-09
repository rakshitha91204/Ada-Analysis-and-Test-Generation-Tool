import { CallGraph } from '../types/graph.types';

export const mockCallGraph: CallGraph = {
  nodes: [
    { id: 'sub_validate', label: 'Validate', kind: 'procedure' },
    { id: 'sub_calculate', label: 'Calculate', kind: 'function' },
    { id: 'sub_add', label: 'Add', kind: 'procedure' },
    { id: 'sub_subtract', label: 'Subtract', kind: 'procedure' },
    { id: 'sub_multiply', label: 'Multiply', kind: 'function' },
    { id: 'sub_divide', label: 'Divide', kind: 'function' },
  ],
  edges: [
    { from: 'sub_validate', to: 'sub_add' },
    { from: 'sub_validate', to: 'sub_subtract' },
    { from: 'sub_calculate', to: 'sub_multiply' },
    { from: 'sub_calculate', to: 'sub_divide' },
    { from: 'sub_validate', to: 'sub_divide' },
  ],
};
