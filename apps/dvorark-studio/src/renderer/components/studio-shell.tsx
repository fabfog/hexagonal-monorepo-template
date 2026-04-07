import type { PropsWithChildren, ReactNode } from "react";
import { Button, Card, Layout, Space, Tag, Typography } from "antd";
import type { WorkspaceState } from "../types";
import { studioThemeColors } from "../theme";

interface StudioShellProps extends PropsWithChildren {
  title: string;
  workspace: WorkspaceState;
  onOpenFolder: () => void;
  extraContent?: ReactNode;
}

export function StudioShell({
  title,
  workspace,
  onOpenFolder,
  extraContent,
  children,
}: StudioShellProps) {
  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: studioThemeColors.pageBg,
        color: studioThemeColors.text,
      }}
    >
      <Layout.Header
        style={{
          background: studioThemeColors.headerBg,
          borderBottom: `1px solid ${studioThemeColors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography.Title level={3} style={{ color: studioThemeColors.text, margin: 0 }}>
          {title}
        </Typography.Title>
        <Button type="primary" onClick={onOpenFolder}>
          Open Folder
        </Button>
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Card
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: studioThemeColors.surfaceBg,
            borderColor: studioThemeColors.border,
          }}
        >
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Space align="center">
              <Tag color={workspace.status === "workspace" ? "success" : "default"}>
                {workspace.status}
              </Tag>
              <Typography.Text style={{ color: studioThemeColors.mutedText }}>
                {workspace.directoryPath ?? "No folder selected"}
              </Typography.Text>
            </Space>
            {children}
            {extraContent}
          </Space>
        </Card>
      </Layout.Content>
    </Layout>
  );
}
