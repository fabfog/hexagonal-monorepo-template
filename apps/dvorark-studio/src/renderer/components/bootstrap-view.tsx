import { useState } from "react";
import { App, Button, Checkbox, Space, Typography } from "antd";
import type { StudioWorkspaceResult } from "../env";
import { studioThemeColors } from "../theme";

interface BootstrapViewProps {
  directoryPath: string;
  onWorkspaceCreated: (workspace: StudioWorkspaceResult) => void;
}

export function BootstrapView({ directoryPath, onWorkspaceCreated }: BootstrapViewProps) {
  const [installDependencies, setInstallDependencies] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { notification } = App.useApp();

  const handleCreateWorkspace = async () => {
    if (!window.dvorarkStudio) return;

    setIsCreating(true);
    try {
      const result = await window.dvorarkStudio.createWorkspace({
        targetDirectory: directoryPath,
        installDependencies,
      });
      onWorkspaceCreated(result);
      notification.success({
        message: "Workspace created",
        description: `Dvorark workspace created in ${directoryPath}.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      notification.error({
        message: "Workspace creation failed",
        description: message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Space direction="vertical" size="middle">
      <Typography.Paragraph style={{ color: studioThemeColors.text, marginBottom: 0 }}>
        This folder is not a Dvorark workspace yet. Creating one will scaffold the monorepo
        baseline, workspace marker, core packages, and configuration files.
      </Typography.Paragraph>
      <Checkbox
        checked={installDependencies}
        onChange={(event) => setInstallDependencies(event.target.checked)}
      >
        Install dependencies after bootstrap
      </Checkbox>
      <Button type="primary" loading={isCreating} onClick={() => void handleCreateWorkspace()}>
        Create Dvorark Workspace
      </Button>
    </Space>
  );
}
