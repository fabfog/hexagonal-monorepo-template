import type { WorkspaceReaderPort } from "@application/dvorark-bootstrap/ports";
import fs from "node:fs";
import path from "node:path";

export class WorkspaceReaderAdapter implements WorkspaceReaderPort {
  async readTextIfExists(workspaceRoot: string, relativePath: string): Promise<string | null> {
    const abs = path.join(workspaceRoot, relativePath);
    if (!fs.existsSync(abs)) {
      return null;
    }
    return fs.readFileSync(abs, "utf8");
  }
}
