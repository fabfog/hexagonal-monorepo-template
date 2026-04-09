import fs from "node:fs";
import path from "node:path";
import { packagePath, packageJsonPath, readPackageJson, writePackageJson } from "./packages.ts";
/**
 * @param {string} repoRoot
 * @param {string} domainPackage
 * @returns {{ className: string, fileBase: string }[]}
 */
function listExportedVoClasses(repoRoot: string, domainPackage: string) {
  const voDir = packagePath(repoRoot, "domain", domainPackage, "src", "value-objects");
  if (!fs.existsSync(voDir)) {
    return [];
  }
  /** @type {{ className: string, fileBase: string }[]} */
  const out = [];
  for (const entry of fs.readdirSync(voDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".vo.ts") || entry.name.endsWith(".test.ts")) {
      continue;
    }
    const abs = path.join(voDir, entry.name);
    const text = fs.readFileSync(abs, "utf8");
    const m = text.match(/export class (\w+)/);
    if (!m?.[1]) continue;
    out.push({
      className: m[1],
      fileBase: entry.name.replace(/\.vo\.ts$/, ""),
    });
  }
  return out.sort((a, b) => a.className.localeCompare(b.className));
}
/**
 * @param {string} repoRoot
 * @param {string} domainPackage
 */
function ensureDomainCoreDependency(repoRoot: string, domainPackage: string) {
  if (domainPackage === "core") {
    return;
  }
  const pkgPath = packageJsonPath(repoRoot, "domain", domainPackage);
  const pkg = readPackageJson(pkgPath);
  pkg.dependencies = pkg.dependencies || {};
  if (!pkg.dependencies["@domain/core"]) {
    pkg.dependencies["@domain/core"] = "workspace:*";
    writePackageJson(pkgPath, pkg);
  }
}
/**
 * Plop list choices: VO from core + feature package (labelled).
 * @param {string} repoRoot
 * @param {string} entityDomainPackage
 * @returns {{ name: string, value: { voClass: string, source: 'core' | 'local' } }[]}
 */
function getVoFieldChoices(repoRoot: string, entityDomainPackage: string) {
  const coreVos = listExportedVoClasses(repoRoot, "core");
  const localVos =
    entityDomainPackage === "core" ? [] : listExportedVoClasses(repoRoot, entityDomainPackage);
  const localNames = new Set(localVos.map((v) => v.className));
  /** @type {{ name: string, value: { voClass: string, source: 'core' | 'local' } }[]} */
  const choices = [];
  for (const v of localVos) {
    choices.push({
      name: `${v.className} (@domain/${entityDomainPackage})`,
      value: { voClass: v.className, source: "local" },
    });
  }
  for (const v of coreVos) {
    if (localNames.has(v.className)) {
      continue;
    }
    choices.push({
      name: `${v.className} (@domain/core)`,
      value: { voClass: v.className, source: "core" },
    });
  }
  return choices.sort((a, b) => a.name.localeCompare(b.name));
}
/**
 * @param {string} content
 * @param {string} entityPascal e.g. Ticket for TicketSchema
 * @param {{ prop: string, voClass: string, source: 'core' | 'local' }} field
 */
function appendVoFieldToEntitySource(
  content: string,
  entityPascal: string,
  field: { prop: string; voClass: string; source: "core" | "local" }
) {
  const schemaConst = `${entityPascal}Schema`;
  const marker = `export const ${schemaConst} = z.object(`;
  const mi = content.indexOf(marker);
  if (mi === -1) {
    throw new Error(`Could not find ${schemaConst} = z.object(`);
  }
  let pos = mi + marker.length;
  while (pos < content.length && /\s/.test(content[pos]!)) pos++;
  if (pos >= content.length || content[pos] !== "{") {
    throw new Error(`Malformed schema: expected { after z.object(`);
  }
  let depth = 1;
  const bodyStart = pos + 1;
  pos++;
  while (pos < content.length && depth > 0) {
    const ch = content[pos];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    pos++;
  }
  if (depth !== 0) {
    throw new Error(`Unbalanced braces in ${schemaConst}`);
  }
  const bodyEnd = pos - 1;
  const body = content.slice(bodyStart, bodyEnd);
  const propNeedle = new RegExp(`\\b${field.prop}\\s*:`);
  if (propNeedle.test(body)) {
    throw new Error(`Property "${field.prop}" already exists in ${schemaConst}.`);
  }
  const fieldLine = `  ${field.prop}: ${field.voClass}Schema.transform((x) => new ${field.voClass}(x))`;
  /** True if there is at least one real object property (not only comments / whitespace). */
  const hasSubstantiveField = /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:/m.test(body);
  let newInner;
  if (!hasSubstantiveField) {
    newInner = `\n  ${fieldLine},\n  `;
  } else {
    const trimmed = body.trimEnd();
    const needsComma = trimmed.length > 0 && !trimmed.endsWith(",");
    newInner = `${trimmed}${needsComma ? "," : ""}\n  ${fieldLine},\n  `;
  }
  let next = `${content.slice(0, bodyStart)}${newInner}${content.slice(bodyEnd)}`;
  const coreImportRe = /import\s*\{([^}]*)\}\s*from\s*['"]@domain\/core\/value-objects['"]\s*;/;
  const localImportRe = /import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/value-objects['"]\s*;/;
  const mergeNamed = (existing: string, additions: string[]) => {
    const set = new Set(
      existing
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    );
    for (const a of additions) set.add(a);
    return [...set].sort().join(", ");
  };
  const addSymbols = [field.voClass, `${field.voClass}Schema`];
  if (field.source === "core") {
    const m = next.match(coreImportRe);
    if (m) {
      const merged = mergeNamed(m[1] ?? "", addSymbols);
      next = next.replace(coreImportRe, `import { ${merged} } from '@domain/core/value-objects';`);
    } else {
      const zImportIdx = next.indexOf("import { z }");
      const insertAt = zImportIdx === -1 ? 0 : next.indexOf("\n", zImportIdx) + 1;
      const line = `import { ${addSymbols.join(", ")} } from '@domain/core/value-objects';\n`;
      next = next.slice(0, insertAt) + line + next.slice(insertAt);
    }
  } else {
    const m = next.match(localImportRe);
    if (m) {
      const merged = mergeNamed(m[1] ?? "", addSymbols);
      next = next.replace(localImportRe, `import { ${merged} } from '../value-objects';`);
    } else {
      const idImportRe = new RegExp(
        `(import\\s*\\{[^}]+}\\s*from\\s*['"]\\.\\./value-objects/[^'"]+['"]\\s*;\\s*\\n)`
      );
      const idm = next.match(idImportRe);
      const insertAt =
        idm !== null && idm.index !== undefined
          ? idm.index + idm[0].length
          : next.indexOf("\n") + 1;
      const line = `import { ${addSymbols.join(", ")} } from '../value-objects';\n`;
      next = next.slice(0, insertAt) + line + next.slice(insertAt);
    }
  }
  return next;
}
export {
  listExportedVoClasses,
  ensureDomainCoreDependency,
  getVoFieldChoices,
  appendVoFieldToEntitySource,
};
