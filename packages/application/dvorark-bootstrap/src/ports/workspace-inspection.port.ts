export interface WorkspaceInspectionPort {
  hasWorkspaceMarker(targetDirectory: string): Promise<boolean>;
}
