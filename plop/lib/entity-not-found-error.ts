import fs from "node:fs";
import path from "node:path";
import type { ActionType } from "node-plop";
import { toKebabCase, toConstantCase } from "./casing.ts";
import { ensureDomainPackageSlice } from "./ensure-package-slice.ts";

interface AppendEntityNotFoundActionsOpts {
  repoRoot: string;
  domainPackage: string;
  entityPascal: string;
}
/**
 * Naming for `{EntityPascal}NotFoundError` (e.g. User → UserNotFoundError, file user-not-found.error.ts).
 * @param {string} entityPascal e.g. User, Document
 */
function getEntityNotFoundErrorSpec(entityPascal: string) {
  const stem = `${entityPascal}NotFound`;
  return {
    className: `${entityPascal}NotFoundError`,
    fileKebab: toKebabCase(stem),
    code: toConstantCase(stem),
  };
}
/**
 * DomainError subclass: missing entity id in message (`{Entity} ${id} not found`) and metadata.
 * @param {string} entityPascal e.g. User
 */
function renderEntityNotFoundErrorFile(entityPascal: string) {
  const spec = getEntityNotFoundErrorSpec(entityPascal);
  return `import { DomainError } from "@domain/core/errors";

export class ${spec.className} extends DomainError {
  constructor(public readonly id: string) {
    super({
      code: "${spec.code}",
      message: \`${entityPascal} \${id} not found\`,
      metadata: { id },
      cause: undefined,
    });
  }
}
`;
}
/**
 * Append `export * from './{file}.error';` to domain errors barrel (same rules as domain-error generator).
 * @param {string} fileContents
 * @param {string} fileKebab without .ts (e.g. user-not-found)
 */
function appendDomainErrorsBarrelExport(fileContents: string, fileKebab: string) {
  const cleaned = fileContents.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
  const exportLine = `export * from './${fileKebab}.error';`;
  if (cleaned.includes(exportLine)) {
    return `${cleaned}\n`;
  }
  const base = cleaned.length > 0 ? `${cleaned}\n` : "";
  return `${base}${exportLine}\n`;
}
/**
 * Plop actions: add `{entityPascal}NotFoundError` if missing + merge `errors/index.ts`.
 * Idempotent if the error file or barrel export already exists.
 * @param {import('plop').ActionType[]} actions
 * @param {{ repoRoot: string, domainPackage: string, entityPascal: string }} opts
 */
function appendEnsureEntityNotFoundErrorActions(
  actions: (ActionType | (() => string))[],
  opts: AppendEntityNotFoundActionsOpts
) {
  const { repoRoot, domainPackage, entityPascal } = opts;
  const nf = getEntityNotFoundErrorSpec(entityPascal);
  const errorRelPath = `../packages/domain/${domainPackage}/src/errors/${nf.fileKebab}.error.ts`;
  const errorsIndexRel = `../packages/domain/${domainPackage}/src/errors/index.ts`;
  const errorAbsPath = path.join(
    repoRoot,
    "packages",
    "domain",
    domainPackage,
    "src",
    "errors",
    `${nf.fileKebab}.error.ts`
  );
  actions.unshift(() => {
    ensureDomainPackageSlice(repoRoot, domainPackage, "errors");
    return "";
  });
  if (!fs.existsSync(errorAbsPath)) {
    actions.push({
      type: "add",
      path: errorRelPath,
      template: renderEntityNotFoundErrorFile(entityPascal),
    });
  }
  actions.push({
    type: "modify",
    path: errorsIndexRel,
    transform: (file: string) => appendDomainErrorsBarrelExport(file, nf.fileKebab),
  });
}
export {
  getEntityNotFoundErrorSpec,
  renderEntityNotFoundErrorFile,
  appendDomainErrorsBarrelExport,
  appendEnsureEntityNotFoundErrorActions,
};
