import fs from "node:fs";
import path from "node:path";
import { toPascalCase } from "./casing.ts";
import { appendImportsIfMissing } from "./module-wire-ast.ts";
import { findImportModuleForIdentifier } from "./scan-infrastructure-port-implementations.ts";
import { createPlopMorphProject } from "./ts-morph-project.ts";
import {
  ts,
  assertNoConflictingMembers,
  assertNoReturnPropertyConflict,
  loadCompositionInfrastructureAst,
  printUpdatedCompositionInfrastructure,
} from "./composition-infra-ast.ts";

export interface WirePortAdapterOpts {
  propName: string;
  scope: "app" | "request";
  adapterClassName: string;
  adapterNpmPackageName: string;
  portInterfaceName: string;
  adapterFileAbsPath: string;
  requiredConstructorParams: number;
}

/**
 * @param {string} adapterFileAbsPath
 * @param {string} portInterfaceName
 * @returns {string} full import line
 */
function buildPortTypeImportLine(adapterFileAbsPath: string, portInterfaceName: string) {
  const text = fs.readFileSync(adapterFileAbsPath, "utf8");
  const project = createPlopMorphProject({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(adapterFileAbsPath, text, { overwrite: true });
  const resolved = findImportModuleForIdentifier(sf, portInterfaceName);
  if (!resolved) {
    throw new Error(
      `Could not find an import for "${portInterfaceName}" in ${path.basename(adapterFileAbsPath)}. ` +
        'Add `import type { ... } from "..."` for the port interface so composition can import the type.'
    );
  }
  return `import type { ${portInterfaceName} } from "${resolved.moduleSpecifier}";`;
}
/**
 * @param {string} getterName
 * @param {string} ctxParamName
 * @param {string} portInterfaceName
 * @param {string} adapterClassName
 * @param {boolean} needsConstructorStub
 * @returns {string}
 */
function createPrivateGetterMethod(
  getterName: string,
  ctxParamName: string,
  portInterfaceName: string,
  adapterClassName: string,
  needsConstructorStub: boolean
) {
  const fixme = needsConstructorStub
    ? `\n    // FIXME: pass the adapter's required constructor deps (e.g. from RequestContext and/or app-scoped fields on this provider). TypeScript should error until this is fixed.`
    : "";
  return `private ${getterName}(${ctxParamName}: RequestContext): ${portInterfaceName} {${fixme}
    return new ${adapterClassName}();
  }`;
}
/**
 * @param {string} propName
 * @param {string} portInterfaceName
 * @param {string} adapterClassName
 * @param {boolean} needsConstructorStub
 * @returns {string}
 */
function createAppScopedAdapterProperty(
  propName: string,
  portInterfaceName: string,
  adapterClassName: string,
  needsConstructorStub: boolean
) {
  const fixme = needsConstructorStub
    ? `\n  // FIXME: composition-wire-port-adapter — \`new ${adapterClassName}()\` in this field initializer is incomplete; pass the adapter's required constructor deps (e.g. from other app-scoped fields on this provider). TypeScript should error until this is fixed.\n`
    : "\n";
  return `${fixme}  private readonly ${propName}: ${portInterfaceName} = new ${adapterClassName}();`;
}
/**
 * @param {string} compositionInfrastructurePath
 * @param {WirePortAdapterOpts} opts
 * @returns {string}
 */
function wirePortAdapterIntoCompositionInfrastructure(
  compositionInfrastructurePath: string,
  opts: WirePortAdapterOpts
) {
  const {
    propName,
    scope,
    adapterClassName,
    adapterNpmPackageName,
    portInterfaceName,
    adapterFileAbsPath,
    requiredConstructorParams,
  } = opts;
  const portTypeImportLine = buildPortTypeImportLine(adapterFileAbsPath, portInterfaceName);
  const adapterImportLine = `import { ${adapterClassName} } from "${adapterNpmPackageName}";`;
  let text = fs.readFileSync(compositionInfrastructurePath, "utf8");
  text = appendImportsIfMissing(text, [portTypeImportLine, adapterImportLine]);
  fs.writeFileSync(compositionInfrastructurePath, text, "utf8");
  const ast = loadCompositionInfrastructureAst(compositionInfrastructurePath);
  const getterName = `get${toPascalCase(propName)}`;
  assertNoConflictingMembers(ast.providerClass.getMembers(), [propName, getterName]);
  assertNoReturnPropertyConflict(ast.returnObject, propName);
  /** @type {string} */
  let insertedMember;
  /** @type {string} */
  let valueExprForReturn;
  if (scope === "app") {
    insertedMember = createAppScopedAdapterProperty(
      propName,
      portInterfaceName,
      adapterClassName,
      requiredConstructorParams > 0
    );
    valueExprForReturn = `this.${propName}`;
  } else {
    const needsStub = requiredConstructorParams > 0;
    insertedMember = createPrivateGetterMethod(
      getterName,
      ast.ctxParamName,
      portInterfaceName,
      adapterClassName,
      needsStub
    );
    valueExprForReturn = `this.${getterName}(${ast.ctxParamName})`;
  }
  return printUpdatedCompositionInfrastructure({
    ...ast,
    insertedMembers: [insertedMember],
    appendedProperty: ts.makePropertyAssignmentText(propName, valueExprForReturn),
  });
}
/**
 * Ensure composition package.json depends on @infrastructure/<folder> workspace:*.
 * @param {string} compositionPackageJsonPath
 * @param {string} infrastructureNpmPackageName e.g. @infrastructure/driven-repository-demo-support
 */
function ensureCompositionDependsOnInfrastructure(
  compositionPackageJsonPath: string,
  infrastructureNpmPackageName: string
) {
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (pkg.dependencies[infrastructureNpmPackageName]) {
    return;
  }
  pkg.dependencies[infrastructureNpmPackageName] = "workspace:*";
  const keys = Object.keys(pkg.dependencies).sort();
  const sorted: Record<string, string> = {};
  for (const k of keys) sorted[k] = pkg.dependencies[k];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
/**
 * If port type import is from @application/…, ensure that dependency exists on composition package.
 * @param {string} compositionPackageJsonPath
 * @param {string} adapterFileAbsPath
 * @param {string} portInterfaceName
 */
function ensureCompositionDependsOnApplicationForPortImport(
  compositionPackageJsonPath: string,
  adapterFileAbsPath: string,
  portInterfaceName: string
) {
  const text = fs.readFileSync(adapterFileAbsPath, "utf8");
  const project = createPlopMorphProject({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(adapterFileAbsPath, text, { overwrite: true });
  const resolved = findImportModuleForIdentifier(sf, portInterfaceName);
  if (!resolved?.moduleSpecifier?.startsWith("@application/")) {
    return;
  }
  const appPkg = resolved.moduleSpecifier.split("/").slice(0, 2).join("/");
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (pkg.dependencies[appPkg]) {
    return;
  }
  pkg.dependencies[appPkg] = "workspace:*";
  const keys = Object.keys(pkg.dependencies).sort();
  const sorted: Record<string, string> = {};
  for (const k of keys) sorted[k] = pkg.dependencies[k];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
export {
  wirePortAdapterIntoCompositionInfrastructure,
  ensureCompositionDependsOnInfrastructure,
  ensureCompositionDependsOnApplicationForPortImport,
};
