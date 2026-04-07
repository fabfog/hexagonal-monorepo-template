import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { getDvorarkStudioModules } from "@composition/dvorark-studio";

type WorkspaceStatus = "idle" | "bootstrap" | "workspace";

interface OpenedWorkspacePayload {
  directoryPath: string;
  status: WorkspaceStatus;
}

const studioModules = getDvorarkStudioModules({});
let mainWindow: BrowserWindow | null = null;

function getRendererUrl(): string {
  return (
    process.env.ELECTRON_RENDERER_URL ?? `file://${path.join(__dirname, "../renderer/index.html")}`
  );
}

function createWindow(): BrowserWindow {
  const rendererUrl = getRendererUrl();
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  console.log("[dvorark-studio] loading renderer:", rendererUrl);
  window.webContents.on("did-finish-load", () => {
    console.log("[dvorark-studio] renderer finished loading:", window.webContents.getURL());
    void window.webContents
      .executeJavaScript(
        `({
          title: document.title,
          rootExists: Boolean(document.getElementById("root")),
          bodyText: document.body.innerText,
          bodyHtmlLength: document.body.innerHTML.length,
          backgroundColor: getComputedStyle(document.body).backgroundColor,
          hasStudioBridge: typeof window.dvorarkStudio !== "undefined",
        })`
      )
      .then((snapshot) => {
        console.log("[dvorark-studio] renderer snapshot:", snapshot);
      })
      .catch((error: unknown) => {
        console.error("[dvorark-studio] renderer snapshot failed:", error);
      });
  });
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log("[dvorark-studio] renderer console:", {
      level,
      message,
      line,
      sourceId,
    });
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[dvorark-studio] renderer failed to load:", {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("[dvorark-studio] renderer process gone:", details);
  });

  void window.loadURL(rendererUrl);
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  return window;
}

async function resolveWorkspaceStatus(directoryPath: string): Promise<WorkspaceStatus> {
  const result = await studioModules.workspaceBootstrap.getWorkspaceStatus().execute({
    targetDirectory: directoryPath,
  });

  return result.status === "ready" ? "workspace" : "bootstrap";
}

async function openFolder(window: BrowserWindow): Promise<void> {
  const result = await dialog.showOpenDialog(window, {
    properties: ["openDirectory"],
  });

  const directoryPath = result.filePaths[0];
  if (result.canceled || !directoryPath) {
    return;
  }

  const status = await resolveWorkspaceStatus(directoryPath);
  window.webContents.send("studio:workspace-opened", {
    directoryPath,
    status,
  } satisfies OpenedWorkspacePayload);
}

function createMenu(window: BrowserWindow): void {
  const menu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open Folder",
          click: () => {
            void openFolder(window);
          },
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

ipcMain.handle("studio:open-folder", async () => {
  const window = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!window) {
    return { status: "idle" as const };
  }

  const result = await dialog.showOpenDialog(window, {
    properties: ["openDirectory"],
  });

  const directoryPath = result.filePaths[0];
  if (result.canceled || !directoryPath) {
    return { status: "idle" as const };
  }

  return {
    directoryPath,
    status: await resolveWorkspaceStatus(directoryPath),
  };
});

ipcMain.handle(
  "studio:create-workspace",
  async (
    _event,
    payload: {
      targetDirectory: string;
      installDependencies: boolean;
    }
  ) => {
    const repoName = path.basename(payload.targetDirectory);

    await studioModules.workspaceBootstrap.createWorkspaceFromBlueprint().execute({
      targetDirectory: payload.targetDirectory,
      repoName,
      installDependencies: payload.installDependencies,
    });

    return {
      directoryPath: payload.targetDirectory,
      status: "workspace" as const,
    };
  }
);

ipcMain.handle(
  "studio:create-domain-package",
  async (
    _event,
    payload: {
      workspaceRoot: string;
      packageSlugInput: string;
      vitestVersionOverride?: string;
    }
  ) => {
    return studioModules.dvorarkGenerators.createDomainPackage().execute(payload);
  }
);

app.whenReady().then(() => {
  mainWindow = createWindow();
  createMenu(mainWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
