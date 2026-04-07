import fs from "node:fs";
import path from "node:path";

/** Shared kernel package — not a target for generated domain entities. */
const EXCLUDED_DOMAIN_PACKAGE_SLUGS = new Set(["core"]);

export interface ListDomainPackageSlugsOptions {
  /**
   * When `true` (default), omits `core` and other packages not meant for feature entities.
   * Set to `false` to list all domain packages (e.g. domain value-object generator, Plop-aligned).
   */
  excludeCore?: boolean;
}

/**
 * Kebab-case folder names under `packages/domain/` that look like workspace packages (have `package.json`).
 * By default excludes `core`; pass `{ excludeCore: false }` to include it.
 */
export function listDomainPackageSlugs(
  workspaceRoot: string,
  options: ListDomainPackageSlugsOptions = {}
): string[] {
  const excludeCore = options.excludeCore ?? true;
  const domainRoot = path.join(workspaceRoot, "packages", "domain");
  if (!fs.existsSync(domainRoot)) {
    return [];
  }
  const entries = fs.readdirSync(domainRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .filter((e) => fs.existsSync(path.join(domainRoot, e.name, "package.json")))
    .map((e) => e.name)
    .filter((slug) => !excludeCore || !EXCLUDED_DOMAIN_PACKAGE_SLUGS.has(slug))
    .sort((a, b) => a.localeCompare(b));
}
