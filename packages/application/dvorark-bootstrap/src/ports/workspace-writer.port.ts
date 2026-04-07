export interface WorkspaceFileToWrite {
  relativePath: string;
  contents: string;
}

export interface WorkspaceWriterPort {
  writeFiles(targetDirectory: string, files: WorkspaceFileToWrite[]): Promise<void>;
}
