import type { ThemeConfig } from "antd";

export const studioThemeColors = {
  pageBg: "#f3f6fb",
  surfaceBg: "#ffffff",
  headerBg: "#ffffff",
  border: "#d7dee8",
  text: "#0f172a",
  mutedText: "#475569",
  dangerText: "#b91c1c",
};

export const studioThemeConfig: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    colorBgBase: studioThemeColors.pageBg,
    colorTextBase: studioThemeColors.text,
  },
};
