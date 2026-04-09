import fs from "node:fs";
import path from "node:path";
import { toPascalCase } from "./casing.ts";
import { appendImportsIfMissing } from "./module-wire-ast.ts";
import { findImportModuleForIdentifier } from "./scan-infrastructure-port-implementations.ts";
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
  const sf = ts.createSourceFile(
    adapterFileAbsPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
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
 * @returns {ts.MethodDeclaration}
 */
function createPrivateGetterMethod(
  getterName: string,
  ctxParamName: string,
  portInterfaceName: string,
  adapterClassName: string,
  needsConstructorStub: boolean
) {
  const newExpr = ts.factory.createNewExpression(
    ts.factory.createIdentifier(adapterClassName),
    undefined,
    []
  );
  let ret = ts.factory.createReturnStatement(newExpr);
  if (needsConstructorStub) {
    ret = ts.addSyntheticLeadingComment(
      ret,
      ts.SyntaxKind.SingleLineCommentTrivia,
      ` FIXME: pass the adapter's required constructor deps (e.g. from RequestContext and/or app-scoped fields on this provider). TypeScript should error until this is fixed.`,
      true
    );
  }
  return ts.factory.createMethodDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword)],
    undefined,
    ts.factory.createIdentifier(getterName),
    undefined,
    undefined,
    [
      ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        ctxParamName,
        undefined,
        ts.factory.createTypeReferenceNode(
          ts.factory.createIdentifier("RequestContext"),
          undefined
        ),
        undefined
      ),
    ],
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(portInterfaceName), undefined),
    ts.factory.createBlock([ret], true)
  );
}
/**
 * @param {string} propName
 * @param {string} portInterfaceName
 * @param {string} adapterClassName
 * @param {boolean} needsConstructorStub
 * @returns {ts.PropertyDeclaration}
 */
function createAppScopedAdapterProperty(
  propName: string,
  portInterfaceName: string,
  adapterClassName: string,
  needsConstructorStub: boolean
) {
  let decl = ts.factory.createPropertyDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword),
      ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword),
    ],
    ts.factory.createIdentifier(propName),
    undefined,
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(portInterfaceName), undefined),
    ts.factory.createNewExpression(ts.factory.createIdentifier(adapterClassName), undefined, [])
  );
  if (needsConstructorStub) {
    decl = ts.addSyntheticLeadingComment(
      decl,
      ts.SyntaxKind.SingleLineCommentTrivia,
      ` FIXME: composition-wire-port-adapter — \`new ${adapterClassName}()\` in this field initializer is incomplete; pass the adapter's required constructor deps (e.g. from other app-scoped fields on this provider). TypeScript should error until this is fixed.`,
      true
    );
  }
  return decl;
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
  assertNoConflictingMembers(ast.providerClass.members, [propName, getterName]);
  assertNoReturnPropertyConflict(ast.returnObject, propName);
  /** @type {ts.ClassElement} */
  let insertedMember;
  /** @type {ts.Expression} */
  let valueExprForReturn;
  if (scope === "app") {
    insertedMember = createAppScopedAdapterProperty(
      propName,
      portInterfaceName,
      adapterClassName,
      requiredConstructorParams > 0
    );
    valueExprForReturn = ts.factory.createPropertyAccessExpression(
      ts.factory.createThis(),
      ts.factory.createIdentifier(propName)
    );
  } else {
    const needsStub = requiredConstructorParams > 0;
    insertedMember = createPrivateGetterMethod(
      getterName,
      ast.ctxParamName,
      portInterfaceName,
      adapterClassName,
      needsStub
    );
    valueExprForReturn = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        ts.factory.createIdentifier(getterName)
      ),
      undefined,
      [ts.factory.createIdentifier(ast.ctxParamName)]
    );
  }
  return printUpdatedCompositionInfrastructure({
    ...ast,
    insertedMembers: [insertedMember],
    appendedProperty: ts.factory.createPropertyAssignment(
      ts.factory.createIdentifier(propName),
      valueExprForReturn
    ),
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
  const sf = ts.createSourceFile(
    adapterFileAbsPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
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
