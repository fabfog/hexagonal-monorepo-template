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
 * @returns {string}
 */
function createLoadersGetterMethod(getterName: string, ctxParamName: string) {
  return `private ${getterName}(${ctxParamName}: RequestContext): DataLoaderRegistry {
    // Request-scoped registry: keep DataLoader cache bounded to the current request lifecycle.
    return createDataLoaderRegistry();
  }`;
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
  assertNoConflictingMembers(ast.providerClass.getMembers(), [propName, getterName]);
  assertNoReturnPropertyConflict(ast.returnObject, propName);
  const getter = createLoadersGetterMethod(getterName, ast.ctxParamName);
  return printUpdatedCompositionInfrastructure({
    ...ast,
    insertedMembers: [getter],
    appendedProperty: ts.makePropertyAssignmentText(
      propName,
      `this.${getterName}(${ast.ctxParamName})`
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
