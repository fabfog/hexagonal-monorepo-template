import { Space, Typography } from "antd";
import { studioThemeColors } from "../theme";

interface IdleViewProps {
  bridgeAvailable: boolean;
}

export function IdleView({ bridgeAvailable }: IdleViewProps) {
  return (
    <Space direction="vertical" size="small">
      <Typography.Paragraph style={{ color: studioThemeColors.text, marginBottom: 0 }}>
        Open a folder to detect a Dvorark workspace or bootstrap a new one.
      </Typography.Paragraph>
      {!bridgeAvailable && (
        <Typography.Paragraph style={{ color: studioThemeColors.dangerText, marginBottom: 0 }}>
          Studio bridge unavailable. Check preload loading and Electron console output.
        </Typography.Paragraph>
      )}
    </Space>
  );
}
