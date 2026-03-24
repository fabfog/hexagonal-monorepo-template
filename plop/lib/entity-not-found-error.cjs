const fs = require("fs");
const path = require("path");
const { toKebabCase, toConstantCase } = require("./casing.cjs");

/**
 * Naming for `{EntityPascal}NotFoundError` (e.g. User → UserNotFoundError, file user-not-found.error.ts).
 * @param {string} entityPascal e.g. User, Document
 */
function getEntityNotFoundErrorSpec(entityPascal) {
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
function renderEntityNotFoundErrorFile(entityPascal) {
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
function appendDomainErrorsBarrelExport(fileContents, fileKebab) {
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
function appendEnsureEntityNotFoundErrorActions(actions, opts) {
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
  const errorsIndexAbs = path.join(
    repoRoot,
    "packages",
    "domain",
    domainPackage,
    "src",
    "errors",
    "index.ts"
  );

  if (!fs.existsSync(errorAbsPath)) {
    actions.push({
      type: "add",
      path: errorRelPath,
      template: renderEntityNotFoundErrorFile(entityPascal),
    });
  }

  if (!fs.existsSync(errorsIndexAbs)) {
    actions.push({
      type: "add",
      path: errorsIndexRel,
      template: appendDomainErrorsBarrelExport("", nf.fileKebab),
      skipIfExists: true,
    });
  }

  actions.push({
    type: "modify",
    path: errorsIndexRel,
    skip: () => !fs.existsSync(errorsIndexAbs),
    transform: (file) => appendDomainErrorsBarrelExport(file, nf.fileKebab),
  });
}

module.exports = {
  getEntityNotFoundErrorSpec,
  renderEntityNotFoundErrorFile,
  appendDomainErrorsBarrelExport,
  appendEnsureEntityNotFoundErrorActions,
};
