import { Typography } from "antd";
import { studioThemeColors } from "../theme";

export function WorkspaceView() {
  return (
    <Typography.Paragraph style={{ color: studioThemeColors.text, marginBottom: 0 }}>
      Workspace detected. Generator, wiring, and graph tools will live here next.
    </Typography.Paragraph>
  );
}
