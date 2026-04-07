import type { WorkspaceInspectionPort } from "@application/dvorark-bootstrap/ports";
import fs from "node:fs";
import path from "node:path";

const DVORARK_WORKSPACE_MARKER = "dvorark.json";

export class WorkspaceInspectionAdapter implements WorkspaceInspectionPort {
  async hasWorkspaceMarker(targetDirectory: string): Promise<boolean> {
    return fs.existsSync(path.join(targetDirectory, DVORARK_WORKSPACE_MARKER));
  }
}
