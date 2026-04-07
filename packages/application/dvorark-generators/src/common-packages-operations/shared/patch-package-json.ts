interface PackageJsonLike {
  dependencies?: Record<string, string>;
  exports?: Record<string, string> | unknown[];
}

function stringifyPackageJson(pkg: PackageJsonLike): string {
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/**
 * Ensures `dependencies.zod` when missing, using the provided workspace-resolved range.
 */
export function applyZodDevDependencyToPackageJson(pkg: PackageJsonLike, zodRange: string): void {
  pkg.dependencies = pkg.dependencies ?? {};
  if (!pkg.dependencies.zod) {
    pkg.dependencies.zod = zodRange;
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
 * Parses `package.json` text, ensures `zod` dependency, stringifies.
 */
export function patchPackageJsonEnsureZodDependency(raw: string, zodRange: string): string {
  const pkg = JSON.parse(raw) as PackageJsonLike;
  applyZodDevDependencyToPackageJson(pkg, zodRange);
  return stringifyPackageJson(pkg);
}

export interface PatchPackageJsonWithZodAndExportsOptions extends PatchPackageJsonExportsOptions {
  /** Resolved semver range for `zod` (from workspace or CLI override). */
  zodRange: string;
}

/**
 * Ensures `zod` and conditional `exports` in one pass.
 */
export function patchPackageJsonWithZodAndExports(
  raw: string,
  options: PatchPackageJsonWithZodAndExportsOptions
): string {
  const pkg = JSON.parse(raw) as PackageJsonLike;
  applyZodDevDependencyToPackageJson(pkg, options.zodRange);
  applyConditionalExportsToPackageJson(pkg, options.exportSubpaths);
  return stringifyPackageJson(pkg);
}

/**
 * Ensures `@domain/core` in `dependencies` when missing (workspace protocol).
 * Matches Plop `ensureDomainCoreDependency` for non-`core` feature packages.
 */
export function applyDomainCoreDependencyToPackageJson(pkg: PackageJsonLike): void {
  pkg.dependencies = pkg.dependencies ?? {};
  if (!pkg.dependencies["@domain/core"]) {
    pkg.dependencies["@domain/core"] = "workspace:*";
  }
}

export interface PatchPackageJsonZodAndOptionalDomainCoreOptions {
  zodRange: string;
  /** When true and `@domain/core` is absent, add `workspace:*`. */
  ensureDomainCore: boolean;
}

/**
 * Ensures `zod` and optionally `@domain/core` without touching `exports`.
 */
export function patchPackageJsonZodAndOptionalDomainCore(
  raw: string,
  options: PatchPackageJsonZodAndOptionalDomainCoreOptions
): string {
  const pkg = JSON.parse(raw) as PackageJsonLike;
  applyZodDevDependencyToPackageJson(pkg, options.zodRange);
  if (options.ensureDomainCore) {
    applyDomainCoreDependencyToPackageJson(pkg);
  }
  return stringifyPackageJson(pkg);
}
