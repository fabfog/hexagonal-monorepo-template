import type {
  GeneratorBlueprintFile,
  GeneratorBlueprintSourcePort,
} from "@application/dvorark-generators/ports";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveBlueprintsGeneratorsRoot(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    const candidate = path.join(currentDir, "blueprints", "generators");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(
        `Unable to locate blueprints/generators from ${startDir}. Ensure the Dvorark repo root is reachable.`
      );
    }

    currentDir = parentDir;
  }
}

const BLUEPRINTS_GENERATORS_ROOT = resolveBlueprintsGeneratorsRoot(dirname);

function collectBlueprintFiles(generatorRoot: string): GeneratorBlueprintFile[] {
  const out: GeneratorBlueprintFile[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(generatorRoot, full).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.name.endsWith(".hbs")) {
        out.push({
          relativePath: rel.slice(0, -".hbs".length),
          kind: "template",
          contents: fs.readFileSync(full, "utf8"),
        });
      } else {
        out.push({
          relativePath: rel,
          kind: "static",
          contents: fs.readFileSync(full, "utf8"),
        });
      }
    }
  }

  walk(generatorRoot);
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

export class GeneratorBlueprintSourceAdapter implements GeneratorBlueprintSourcePort {
  async load(generatorId: string): Promise<GeneratorBlueprintFile[]> {
    const root = path.join(BLUEPRINTS_GENERATORS_ROOT, generatorId);
    if (!fs.existsSync(root)) {
      throw new Error(`Unknown generator blueprint: ${generatorId} (expected ${root})`);
    }

    return collectBlueprintFiles(root);
  }
}
