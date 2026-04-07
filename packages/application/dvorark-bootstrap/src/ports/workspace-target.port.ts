export interface WorkspaceTargetPort {
  ensureReadyForCreate(targetDirectory: string): Promise<void>;
}
