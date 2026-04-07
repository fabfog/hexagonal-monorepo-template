import type { GeneratorToolingDefaultsPort } from "@application/dvorark-generators/ports";
import fs from "node:fs";
import path from "node:path";

const FALLBACK_VITEST_RANGE = "^4.1.0";

export class GeneratorToolingDefaultsAdapter implements GeneratorToolingDefaultsPort {
  async vitestRange(workspaceRoot: string): Promise<string> {
    const pkgPath = path.join(workspaceRoot, "package.json");
    if (!fs.existsSync(pkgPath)) {
      return FALLBACK_VITEST_RANGE;
    }

    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { devDependencies?: Record<string, string> };
    const v = pkg.devDependencies?.vitest;
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }

    return FALLBACK_VITEST_RANGE;
  }
}
