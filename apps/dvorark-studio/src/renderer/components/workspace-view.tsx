import { useState } from "react";
import { App, Button, Form, Input, Space, Typography } from "antd";
import { studioThemeColors } from "../theme";

interface WorkspaceViewProps {
  workspaceRoot: string;
}

export function WorkspaceView({ workspaceRoot }: WorkspaceViewProps) {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const { notification } = App.useApp();

  const handleCreate = async () => {
    const trimmed = slug.trim();
    if (!trimmed) {
      notification.warning({ message: "Enter a package name" });
      return;
    }
    if (!workspaceRoot) {
      notification.error({ message: "No workspace folder" });
      return;
    }
    const bridge = window.dvorarkStudio?.createDomainPackage;
    if (!bridge) {
      notification.error({ message: "Studio bridge unavailable" });
      return;
    }

    setLoading(true);
    try {
      const result = await bridge({
        workspaceRoot,
        packageSlugInput: trimmed,
      });
      notification.success({
        message: `Created @domain/${result.packageSlug}`,
        description: `${String(result.filesWritten)} file(s) written.`,
      });
      setSlug("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      notification.error({ message: "Create domain package failed", description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Paragraph style={{ color: studioThemeColors.text, marginBottom: 0 }}>
        Workspace ready. Create a new domain package under{" "}
        <Typography.Text code>packages/domain/&lt;slug&gt;</Typography.Text> in this repo.
      </Typography.Paragraph>

      <Form layout="vertical" style={{ maxWidth: 420 }}>
        <Form.Item label="Package slug / name" required>
          <Input
            placeholder="e.g. user or UserProfile"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onPressEnter={() => void handleCreate()}
            disabled={loading || !workspaceRoot}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" loading={loading} onClick={() => void handleCreate()}>
            Create domain package
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
}
