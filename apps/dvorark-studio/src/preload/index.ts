import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("dvorarkStudio", {
  openFolder: () => ipcRenderer.invoke("studio:open-folder"),
  createWorkspace: (payload: { targetDirectory: string; installDependencies: boolean }) =>
    ipcRenderer.invoke("studio:create-workspace", payload),
  onWorkspaceOpened: (
    listener: (payload: { directoryPath: string; status: "bootstrap" | "workspace" }) => void
  ) => {
    const subscription = (
      _event: unknown,
      payload: { directoryPath: string; status: "bootstrap" | "workspace" }
    ) => listener(payload);

    ipcRenderer.on("studio:workspace-opened", subscription);
    return () => {
      ipcRenderer.removeListener("studio:workspace-opened", subscription);
    };
  },
});
