export type FileType = 'spec' | 'body';
export type FileStatus = 'pending' | 'parsing' | 'parsed' | 'error';

export interface AdaFile {
  id: string;
  name: string;
  content: string;
  type: FileType;
  status: FileStatus;
  errorMessage?: string;
  uploadedAt: string;
  folderId?: string;   // set when file came from a folder upload
  folderName?: string; // display name of the source folder
  relativePath?: string; // path within the folder e.g. "src/calc.adb"
}

export interface AdaFolder {
  id: string;
  name: string;
  fileIds: string[];
  uploadedAt: string;
}
