import { useEffect, useMemo, useState } from "react";
import { App } from "antd";
import { BootstrapView } from "./components/bootstrap-view";
import { IdleView } from "./components/idle-view";
import { StudioShell } from "./components/studio-shell";
import { WorkspaceView } from "./components/workspace-view";
import type { StudioWorkspaceResult } from "./env";
import type { WorkspaceState } from "./types";

export function StudioApp() {
  const [workspace, setWorkspace] = useState<WorkspaceState>({ status: "idle" });
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const { notification } = App.useApp();

  useEffect(() => {
    const studioBridge = window.dvorarkStudio;
    if (!studioBridge) {
      notification.error({
        message: "Studio bridge unavailable",
        description: "Electron preload bridge was not loaded correctly.",
      });
      return;
    }

    setBridgeAvailable(true);

    return studioBridge.onWorkspaceOpened((payload) => {
      setWorkspace(payload);
    });
  }, [notification]);

  const title = useMemo(() => {
    if (workspace.status === "workspace") return "Dvorark Workspace";
    if (workspace.status === "bootstrap") return "Create Dvorark Workspace";
    return "Dvorark Studio";
  }, [workspace.status]);

  const handleOpenFolder = async () => {
    if (!window.dvorarkStudio) return;
    const result = await window.dvorarkStudio.openFolder();
    setWorkspace(result);
  };

  const handleWorkspaceCreated = (nextWorkspace: StudioWorkspaceResult) => {
    setWorkspace(nextWorkspace);
  };

  return (
    <StudioShell title={title} workspace={workspace} onOpenFolder={() => void handleOpenFolder()}>
      {workspace.status === "idle" && <IdleView bridgeAvailable={bridgeAvailable} />}
      {workspace.status === "bootstrap" && (
        <BootstrapView
          directoryPath={workspace.directoryPath ?? ""}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      )}
      {workspace.status === "workspace" && (
        <WorkspaceView workspaceRoot={workspace.directoryPath ?? ""} />
      )}
    </StudioShell>
  );
}
