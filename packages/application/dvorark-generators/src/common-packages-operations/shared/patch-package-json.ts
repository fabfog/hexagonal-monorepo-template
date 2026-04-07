import { DEFAULT_ZOD_DEV_RANGE } from "./constants";

interface PackageJsonLike {
  dependencies?: Record<string, string>;
  exports?: Record<string, string> | unknown[];
}

function stringifyPackageJson(pkg: PackageJsonLike): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/**
 * Ensures `dependencies.zod` when missing (domain packages generated for Zod-based code).
 */
export function applyZodDevDependencyToPackageJson(pkg: PackageJsonLike): void {
  pkg.dependencies = pkg.dependencies ?? {};
  if (!pkg.dependencies.zod) {
    pkg.dependencies.zod = DEFAULT_ZOD_DEV_RANGE;
  }
}

/**
 * Ensures `./<slice>` conditional `exports` when missing. Does not remove or overwrite existing keys.
 */
export function applyConditionalExportsToPackageJson(
  pkg: PackageJsonLike,
  exportSubpaths: readonly string[]
): void {
  if (!pkg.exports || typeof pkg.exports !== "object" || Array.isArray(pkg.exports)) {
    pkg.exports = {};
  }
  const exportsObj = pkg.exports as Record<string, string>;
  for (const sub of exportSubpaths) {
    const key = `./${sub}`;
    if (!exportsObj[key]) {
      exportsObj[key] = `./src/${sub}/index.ts`;
    }
  }
}

export interface PatchPackageJsonExportsOptions {
  exportSubpaths: readonly string[];
}

/**
 * Parses `package.json` text, merges conditional exports, stringifies.
 */
export function patchPackageJsonExports(
  raw: string,
  options: PatchPackageJsonExportsOptions
): string {
  const pkg = JSON.parse(raw) as PackageJsonLike;
  applyConditionalExportsToPackageJson(pkg, options.exportSubpaths);
  return stringifyPackageJson(pkg);
}

/**
 * Parses `package.json` text, ensures `zod` dev dependency, stringifies.
 */
export function patchPackageJsonEnsureZodDependency(raw: string): string {
  const pkg = JSON.parse(raw) as PackageJsonLike;
  applyZodDevDependencyToPackageJson(pkg);
  return stringifyPackageJson(pkg);
}

export interface PatchPackageJsonWithZodAndExportsOptions {
  exportSubpaths: readonly string[];
}

/**
 * Ensures `zod` and conditional `exports` in one pass (same as applying both concerns sequentially without double stringify of unrelated fields).
 */
export function patchPackageJsonWithZodAndExports(
  raw: string,
  options: PatchPackageJsonWithZodAndExportsOptions
): string {
  const pkg = JSON.parse(raw) as PackageJsonLike;
  applyZodDevDependencyToPackageJson(pkg);
  applyConditionalExportsToPackageJson(pkg, options.exportSubpaths);
  return stringifyPackageJson(pkg);
}
