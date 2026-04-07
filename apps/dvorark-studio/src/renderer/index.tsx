import { createRoot } from "react-dom/client";
import { App, ConfigProvider } from "antd";
import { StudioApp } from "./studio-app";
import { studioThemeConfig } from "./theme";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Renderer root element not found");
}

createRoot(container).render(
  <ConfigProvider theme={studioThemeConfig}>
    <App>
      <StudioApp />
    </App>
  </ConfigProvider>
);
