export type WorkspaceStatus = "idle" | "bootstrap" | "workspace";

export interface WorkspaceState {
  directoryPath?: string;
  status: WorkspaceStatus;
}
