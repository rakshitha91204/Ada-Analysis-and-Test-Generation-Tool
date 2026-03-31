export type SubprogramKind = 'procedure' | 'function';

export interface Parameter {
  name: string;
  paramType: string;
  mode: 'in' | 'out' | 'in out';
}

export interface Subprogram {
  id: string;
  fileId: string;
  name: string;
  kind: SubprogramKind;
  parameters: Parameter[];
  returnType?: string;
  startLine: number;
  endLine: number;
  testCount: number;
  lastGeneratedAt?: string;
}
