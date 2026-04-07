export interface StudioWorkspaceResult {
  directoryPath?: string;
  status: "idle" | "bootstrap" | "workspace";
}

declare global {
  interface Window {
    dvorarkStudio?: {
      openFolder: () => Promise<StudioWorkspaceResult>;
      createWorkspace: (payload: {
        targetDirectory: string;
        installDependencies: boolean;
      }) => Promise<StudioWorkspaceResult>;
      onWorkspaceOpened: (
        listener: (payload: { directoryPath: string; status: "bootstrap" | "workspace" }) => void
      ) => () => void;
    };
  }
}

export {};
