import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          "@composition/dvorark-studio",
          "@application/dvorark-bootstrap",
          "@application/dvorark-generators",
          "@infrastructure/driven-dvorark-bootstrap",
          "@infrastructure/driven-dvorark-generators",
        ],
      }),
    ],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
  },
});
