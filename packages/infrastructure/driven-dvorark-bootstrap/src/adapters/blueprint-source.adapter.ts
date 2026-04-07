import type {
  BlueprintSourceFile,
  BlueprintSourcePort,
} from "@application/dvorark-bootstrap/ports";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(dirname, "../../../../../");
const BLUEPRINT_ROOT = path.join(REPO_ROOT, "blueprints", "starter");

function readFilesRecursively(
  rootDir: string,
  currentDir: string = rootDir
): BlueprintSourceFile[] {
  const out: BlueprintSourceFile[] = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const abs = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...readFilesRecursively(rootDir, abs));
      continue;
    }
    const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
    out.push({
      relativePath: rel.replace(/^root\//, "").replace(/\.hbs$/, ""),
      kind: rel.endsWith(".hbs") ? "template" : "static",
      contents: fs.readFileSync(abs, "utf8"),
    });
  }
  return out;
}

export class BlueprintSourceAdapter implements BlueprintSourcePort {
  async readStarterBlueprint(): Promise<BlueprintSourceFile[]> {
    return readFilesRecursively(BLUEPRINT_ROOT);
  }
}
