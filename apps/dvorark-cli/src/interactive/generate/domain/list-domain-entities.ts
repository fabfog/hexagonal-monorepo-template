import fs from "node:fs";
import path from "node:path";

/** Aligns with Plop `toPascalCase` on kebab entity file stems. */
function kebabStemToPascalEntityStem(base: string): string {
  return base
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}

/**
 * PascalCase entity stems from `*.entity.ts` under `packages/domain/<slug>/src/entities/`
 * (same naming as Plop `getDomainEntityChoices` values).
 */
export function listDomainEntityPascalNames(
  workspaceRoot: string,
  domainPackageSlug: string
): string[] {
  const entitiesDir = path.join(
    workspaceRoot,
    "packages",
    "domain",
    domainPackageSlug,
    "src",
    "entities"
  );
  if (!fs.existsSync(entitiesDir)) {
    return [];
  }
  return fs
    .readdirSync(entitiesDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".entity.ts"))
    .map((e) => {
      const base = e.name.replace(/\.entity\.ts$/, "");
      return kebabStemToPascalEntityStem(base);
    })
    .sort((a, b) => a.localeCompare(b));
}
