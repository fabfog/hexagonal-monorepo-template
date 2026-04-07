import type { WorkspaceTargetPort } from "@application/dvorark-bootstrap/ports";
import fs from "node:fs";

export class WorkspaceTargetAdapter implements WorkspaceTargetPort {
  async ensureReadyForCreate(targetDirectory: string): Promise<void> {
    if (!fs.existsSync(targetDirectory)) {
      fs.mkdirSync(targetDirectory, { recursive: true });
      return;
    }

    const stat = fs.statSync(targetDirectory);
    if (!stat.isDirectory()) {
      throw new Error(`Target exists and is not a directory: ${targetDirectory}`);
    }

    const entries = fs.readdirSync(targetDirectory);
    if (entries.length > 0) {
      throw new Error(`Target directory is not empty: ${targetDirectory}`);
    }
  }
}
