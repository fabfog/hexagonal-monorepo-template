import type { WorkspaceInstallPort } from "@application/dvorark-bootstrap/ports";
import { execFile } from "node:child_process";

function runPnpmInstall(targetDirectory: string) {
  return new Promise<void>((resolve, reject) => {
    execFile("pnpm", ["install"], { cwd: targetDirectory }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export class WorkspaceInstallAdapter implements WorkspaceInstallPort {
  async installDependencies(targetDirectory: string): Promise<void> {
    await runPnpmInstall(targetDirectory);
  }
}
