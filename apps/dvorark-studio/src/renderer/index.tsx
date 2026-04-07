import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { App, Button, Card, Checkbox, ConfigProvider, Layout, Space, Tag, Typography } from "antd";

type WorkspaceStatus = "idle" | "bootstrap" | "workspace";

const themeColors = {
  pageBg: "#f3f6fb",
  surfaceBg: "#ffffff",
  headerBg: "#ffffff",
  border: "#d7dee8",
  text: "#0f172a",
  mutedText: "#475569",
  dangerText: "#b91c1c",
};

interface WorkspaceState {
  directoryPath?: string;
  status: WorkspaceStatus;
}

function StudioApp() {
  const [workspace, setWorkspace] = useState<WorkspaceState>({ status: "idle" });
  const [installDependencies, setInstallDependencies] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
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

  const handleCreateWorkspace = async () => {
    if (!workspace.directoryPath || !window.dvorarkStudio) return;

    setIsCreating(true);
    try {
      const result = await window.dvorarkStudio.createWorkspace({
        targetDirectory: workspace.directoryPath,
        installDependencies,
      });
      setWorkspace(result);
      notification.success({
        message: "Workspace created",
        description: `Dvorark workspace created in ${workspace.directoryPath}.`,
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
    <Layout
      style={{
        minHeight: "100vh",
        background: themeColors.pageBg,
        color: themeColors.text,
      }}
    >
      <Layout.Header
        style={{
          background: themeColors.headerBg,
          borderBottom: `1px solid ${themeColors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography.Title level={3} style={{ color: themeColors.text, margin: 0 }}>
          {title}
        </Typography.Title>
        <Button type="primary" onClick={() => void handleOpenFolder()}>
          Open Folder
        </Button>
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Card
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: themeColors.surfaceBg,
            borderColor: themeColors.border,
          }}
        >
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Space align="center">
              <Tag color={workspace.status === "workspace" ? "success" : "default"}>
                {workspace.status}
              </Tag>
              <Typography.Text style={{ color: themeColors.mutedText }}>
                {workspace.directoryPath ?? "No folder selected"}
              </Typography.Text>
            </Space>

            {workspace.status === "idle" && (
              <Space direction="vertical" size="small">
                <Typography.Paragraph style={{ color: themeColors.text, marginBottom: 0 }}>
                  Open a folder to detect a Dvorark workspace or bootstrap a new one.
                </Typography.Paragraph>
                {!bridgeAvailable && (
                  <Typography.Paragraph style={{ color: themeColors.dangerText, marginBottom: 0 }}>
                    Studio bridge unavailable. Check preload loading and Electron console output.
                  </Typography.Paragraph>
                )}
              </Space>
            )}

            {workspace.status === "bootstrap" && (
              <Space direction="vertical" size="middle">
                <Typography.Paragraph style={{ color: themeColors.text, marginBottom: 0 }}>
                  This folder is not a Dvorark workspace yet. Creating one will scaffold the
                  monorepo baseline, workspace marker, core packages, and configuration files.
                </Typography.Paragraph>
                <Checkbox
                  checked={installDependencies}
                  onChange={(event) => setInstallDependencies(event.target.checked)}
                >
                  Install dependencies after bootstrap
                </Checkbox>
                <Button
                  type="primary"
                  loading={isCreating}
                  onClick={() => void handleCreateWorkspace()}
                >
                  Create Dvorark Workspace
                </Button>
              </Space>
            )}

            {workspace.status === "workspace" && (
              <Typography.Paragraph style={{ color: themeColors.text, marginBottom: 0 }}>
                Workspace detected. Generator, wiring, and graph tools will live here next.
              </Typography.Paragraph>
            )}
          </Space>
        </Card>
      </Layout.Content>
    </Layout>
  );
}

const container = document.getElementById("root");
if (!container) {
  throw new Error("Renderer root element not found");
}

createRoot(container).render(
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: "#1677ff",
        colorBgBase: themeColors.pageBg,
        colorTextBase: themeColors.text,
      },
    }}
  >
    <App>
      <StudioApp />
    </App>
  </ConfigProvider>
);
