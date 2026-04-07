import type {
  WorkspaceFileToWrite,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import fs from "node:fs";
import path from "node:path";

export class WorkspaceWriterAdapter implements WorkspaceWriterPort {
  async writeFiles(targetDirectory: string, files: WorkspaceFileToWrite[]): Promise<void> {
    for (const file of files) {
      const abs = path.join(targetDirectory, file.relativePath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, file.contents, "utf8");
    }
  }
}
