import { DEFAULT_ZOD_DEV_RANGE } from "./constants";

export interface PatchPackageJsonWithZodAndExportsOptions {
  /**
   * Segment names after `./` for conditional exports, e.g. `entities` → `./entities` → `./src/entities/index.ts`.
   */
  exportSubpaths: readonly string[];
}

/**
 * Ensures `zod` is listed and conditional `exports` entries exist. Does not remove or overwrite existing keys.
 */
export function patchPackageJsonWithZodAndExports(
  raw: string,
  options: PatchPackageJsonWithZodAndExportsOptions
): string {
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    exports?: Record<string, string> | unknown[];
  };
  pkg.dependencies = pkg.dependencies ?? {};
  if (!pkg.dependencies.zod) {
    pkg.dependencies.zod = DEFAULT_ZOD_DEV_RANGE;
  }
  if (!pkg.exports || typeof pkg.exports !== "object" || Array.isArray(pkg.exports)) {
    pkg.exports = {};
  }
  const exportsObj = pkg.exports as Record<string, string>;
  for (const sub of options.exportSubpaths) {
    const key = `./${sub}`;
    if (!exportsObj[key]) {
      exportsObj[key] = `./src/${sub}/index.ts`;
    }
  }
  return `${JSON.stringify(pkg, null, 2)}\n`;
}
