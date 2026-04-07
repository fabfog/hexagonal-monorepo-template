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

export class GeneratorBlueprintSourceAdapter implements GeneratorBlueprintSourcePort {
  async load(generatorId: string): Promise<GeneratorBlueprintFile[]> {
    const root = path.join(BLUEPRINTS_GENERATORS_ROOT, generatorId);
    if (!fs.existsSync(root)) {
      throw new Error(`Unknown generator blueprint: ${generatorId} (expected ${root})`);
    }

    return [
      {
        relativePath: "package.json",
        kind: "template",
        contents: fs.readFileSync(path.join(root, "package.json.hbs"), "utf8"),
      },
      {
        relativePath: "tsconfig.json",
        kind: "template",
        contents: fs.readFileSync(path.join(root, "tsconfig.json.hbs"), "utf8"),
      },
      {
        relativePath: "src/.gitkeep",
        kind: "static",
        contents: fs.readFileSync(path.join(root, "src", ".gitkeep"), "utf8"),
      },
    ];
  }
}
