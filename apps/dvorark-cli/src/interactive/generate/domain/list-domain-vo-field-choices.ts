import fs from "node:fs";
import path from "node:path";

/** Aligns with Plop `listExportedVoClasses` / `getVoFieldChoices`. */
export interface VoFieldChoiceValue {
  voClass: string;
  source: "core" | "local";
}

export interface VoFieldChoice {
  label: string;
  value: VoFieldChoiceValue;
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

/**
 * VOs from the feature package (local) plus `@domain/core`, de-duplicated by class name (local wins).
 */
export function listVoFieldChoices(
  workspaceRoot: string,
  entityDomainPackage: string
): VoFieldChoice[] {
  const coreVos = listExportedVoClasses(workspaceRoot, "core");
  const localVos =
    entityDomainPackage === "core" ? [] : listExportedVoClasses(workspaceRoot, entityDomainPackage);
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
