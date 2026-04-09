import fs from "node:fs";
import { appendImportsIfMissing } from "./module-wire-ast.ts";
import {
  ts,
  assertNoConflictingMembers,
  assertNoReturnPropertyConflict,
  loadCompositionInfrastructureAst,
  printUpdatedCompositionInfrastructure,
} from "./composition-infra-ast.ts";
/**
 * @param {string} getterName
 * @param {string} ctxParamName
 * @returns {import('typescript').MethodDeclaration}
 */
function createLoadersGetterMethod(getterName: string, ctxParamName: string) {
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
interface DataLoaderWireOpts {
  propName: string;
}

/**
 * @param {string} compositionInfrastructurePath
 * @param {DataLoaderWireOpts} opts
 * @returns {string}
 */
function wireDataLoaderRegistryIntoCompositionInfrastructure(
  compositionInfrastructurePath: string,
  opts: DataLoaderWireOpts
) {
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
function ensureCompositionDependsOnDataLoaderLib(compositionPackageJsonPath: string) {
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (!pkg.dependencies["@infrastructure/lib-dataloader"]) {
    pkg.dependencies["@infrastructure/lib-dataloader"] = "workspace:*";
  }
  const keys = Object.keys(pkg.dependencies).sort();
  const sorted: Record<string, string> = {};
  for (const key of keys) sorted[key] = pkg.dependencies[key];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
export {
  wireDataLoaderRegistryIntoCompositionInfrastructure,
  ensureCompositionDependsOnDataLoaderLib,
};
