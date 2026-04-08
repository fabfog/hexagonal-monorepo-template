import fs from "node:fs";
import path from "node:path";

import type {
  DomainWorkspaceCatalogPort,
  ListDomainPackageSlugsOptions,
  VoFieldChoice,
} from "@application/dvorark-generators/ports";

/** Shared kernel package — not a target for generated domain entities when `excludeCore` is true. */
const EXCLUDED_DOMAIN_PACKAGE_SLUGS = new Set(["core"]);

function kebabStemToPascalEntityStem(base: string): string {
  return base
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}

function listExportedVoClasses(
  workspaceRoot: string,
  domainPackageSlug: string
): { className: string; fileBase: string }[] {
  const voDir = path.join(
    workspaceRoot,
    "packages",
    "domain",
    domainPackageSlug,
    "src",
    "value-objects"
  );
  if (!fs.existsSync(voDir)) {
    return [];
  }
  const out: { className: string; fileBase: string }[] = [];
  for (const entry of fs.readdirSync(voDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".vo.ts") || entry.name.endsWith(".test.ts")) {
      continue;
    }
    const abs = path.join(voDir, entry.name);
    const text = fs.readFileSync(abs, "utf8");
    const m = text.match(/export class (\w+)/);
    if (!m?.[1]) {
      continue;
    }
    out.push({
      className: m[1],
      fileBase: entry.name.replace(/\.vo\.ts$/, ""),
    });
  }
  return out.sort((a, b) => a.className.localeCompare(b.className));
}

export class DomainWorkspaceCatalogAdapter implements DomainWorkspaceCatalogPort {
  async listDomainPackageSlugs(
    workspaceRoot: string,
    options?: ListDomainPackageSlugsOptions
  ): Promise<string[]> {
    const excludeCore = options?.excludeCore ?? true;
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

  async listDomainEntityPascalNames(
    workspaceRoot: string,
    domainPackageSlug: string
  ): Promise<string[]> {
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

  async listVoFieldChoices(
    workspaceRoot: string,
    entityDomainPackage: string
  ): Promise<VoFieldChoice[]> {
    const coreVos = listExportedVoClasses(workspaceRoot, "core");
    const localVos =
      entityDomainPackage === "core"
        ? []
        : listExportedVoClasses(workspaceRoot, entityDomainPackage);
    const localNames = new Set(localVos.map((v) => v.className));
    const choices: VoFieldChoice[] = [];
    for (const v of localVos) {
      choices.push({
        label: `${v.className} (@domain/${entityDomainPackage})`,
        value: { voClass: v.className, source: "local" },
      });
    }
    for (const v of coreVos) {
      if (localNames.has(v.className)) {
        continue;
      }
      choices.push({
        label: `${v.className} (@domain/core)`,
        value: { voClass: v.className, source: "core" },
      });
    }
    return choices.sort((a, b) => a.label.localeCompare(b.label));
  }
}
