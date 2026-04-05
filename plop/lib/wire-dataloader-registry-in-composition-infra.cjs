"use strict";

const fs = require("fs");
const { appendImportsIfMissing } = require("./module-wire-ast.cjs");
const {
  ts,
  assertNoConflictingMembers,
  assertNoReturnPropertyConflict,
  loadCompositionInfrastructureAst,
  printUpdatedCompositionInfrastructure,
} = require("./composition-infra-ast.cjs");

/**
 * @param {string} getterName
 * @param {string} ctxParamName
 * @returns {import('typescript').MethodDeclaration}
 */
function createLoadersGetterMethod(getterName, ctxParamName) {
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
    ts.factory.createTypeReferenceNode(
      ts.factory.createIdentifier("DataLoaderRegistry"),
      undefined
    ),
    ts.factory.createBlock(
      [
        ts.addSyntheticLeadingComment(
          ts.factory.createReturnStatement(
            ts.factory.createCallExpression(
              ts.factory.createIdentifier("createDataLoaderRegistry"),
              undefined,
              []
            )
          ),
          ts.SyntaxKind.SingleLineCommentTrivia,
          " Request-scoped registry: keep DataLoader cache bounded to the current request lifecycle.",
          true
        ),
      ],
      true
    )
  );
}

/**
 * @param {string} compositionInfrastructurePath
 * @param {{ propName: string }} opts
 * @returns {string}
 */
function wireDataLoaderRegistryIntoCompositionInfrastructure(compositionInfrastructurePath, opts) {
  const propName = opts.propName;
  const getterName = `get${propName.charAt(0).toUpperCase()}${propName.slice(1)}`;
  const importLines = [
    'import { createDataLoaderRegistry, type DataLoaderRegistry } from "@infrastructure/lib-dataloader";',
  ];

  let text = fs.readFileSync(compositionInfrastructurePath, "utf8");
  text = appendImportsIfMissing(text, importLines);
  fs.writeFileSync(compositionInfrastructurePath, text, "utf8");

  const ast = loadCompositionInfrastructureAst(compositionInfrastructurePath);
  assertNoConflictingMembers(ast.providerClass.members, [propName, getterName]);
  assertNoReturnPropertyConflict(ast.returnObject, propName);

  const getter = createLoadersGetterMethod(getterName, ast.ctxParamName);
  return printUpdatedCompositionInfrastructure({
    ...ast,
    insertedMembers: [getter],
    appendedProperty: ts.factory.createPropertyAssignment(
      ts.factory.createIdentifier(propName),
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createThis(),
          ts.factory.createIdentifier(getterName)
        ),
        undefined,
        [ts.factory.createIdentifier(ast.ctxParamName)]
      )
    ),
  });
}

/**
 * @param {string} compositionPackageJsonPath
 */
function ensureCompositionDependsOnDataLoaderLib(compositionPackageJsonPath) {
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (!pkg.dependencies["@infrastructure/lib-dataloader"]) {
    pkg.dependencies["@infrastructure/lib-dataloader"] = "workspace:*";
  }
  const keys = Object.keys(pkg.dependencies).sort();
  /** @type {Record<string, string>} */
  const sorted = {};
  for (const key of keys) sorted[key] = pkg.dependencies[key];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

module.exports = {
  wireDataLoaderRegistryIntoCompositionInfrastructure,
  ensureCompositionDependsOnDataLoaderLib,
};
