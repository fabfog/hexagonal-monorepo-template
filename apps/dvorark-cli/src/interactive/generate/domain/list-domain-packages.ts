import fs from "node:fs";
import path from "node:path";

/** Shared kernel package — not a target for generated domain entities. */
const EXCLUDED_DOMAIN_PACKAGE_SLUGS = new Set(["core"]);

/**
 * Kebab-case folder names under `packages/domain/` that look like workspace packages (have `package.json`),
 * excluding `core` and other shared packages not meant for feature entities.
 */
export function listDomainPackageSlugs(workspaceRoot: string): string[] {
  const domainRoot = path.join(workspaceRoot, "packages", "domain");
  if (!fs.existsSync(domainRoot)) {
    return [];
  }
  const entries = fs.readdirSync(domainRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .filter((e) => fs.existsSync(path.join(domainRoot, e.name, "package.json")))
    .map((e) => e.name)
    .filter((slug) => !EXCLUDED_DOMAIN_PACKAGE_SLUGS.has(slug))
    .sort((a, b) => a.localeCompare(b));
}
