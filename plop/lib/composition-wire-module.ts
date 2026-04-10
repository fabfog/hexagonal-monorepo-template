import fs from "node:fs";
import path from "node:path";
import { Node } from "ts-morph";
import { toCamelCase } from "./casing.ts";
import { appendImportsIfMissing } from "./module-wire-ast.ts";
import { createPlopMorphProject } from "./ts-morph-project.ts";
/**
 * @param {string} absModulePath
 * @returns {string} exported class name ending in Module
 */
function parseExportedModuleClassName(absModulePath: string) {
  const text = fs.readFileSync(absModulePath, "utf8");
  const project = createPlopMorphProject({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(absModulePath, text, { overwrite: true });
  const found = sf
    .getClasses()
    .find((decl) => decl.isExported() && (decl.getName() ?? "").endsWith("Module"));
  const className = found?.getName();
  if (!className) {
    throw new Error(`No exported *Module class in ${absModulePath}`);
  }
  return className;
}
/**
 * @param {import("ts-morph").FunctionDeclaration} fn
 * @returns {string}
 */
function findInfraVariableName(fn: import("ts-morph").FunctionDeclaration) {
  const body = fn.getBodyOrThrow();
  if (!Node.isBlock(body)) {
    throw new Error("Expected get*Modules to have a block body.");
  }
  for (const st of body.getStatements()) {
    if (!Node.isVariableStatement(st)) continue;
    for (const decl of st.getDeclarationList().getDeclarations()) {
      const initializerText = decl.getInitializer()?.getText() ?? "";
      if (initializerText.includes("infrastructureProvider.getForContext")) {
        return decl.getName();
      }
    }
  }
  throw new Error(
    "Could not find `const <name> = infrastructureProvider.getForContext(ctx)` in get*Modules body."
  );
}
/**
 * @param {string} moduleFileName e.g. support-inbox.module.ts
 * @returns {string} kebab base without .module.ts
 */
function moduleFileBaseKebab(moduleFileName: string) {
  if (!moduleFileName.endsWith(".module.ts")) {
    throw new Error(`Expected *.module.ts, got "${moduleFileName}"`);
  }
  return moduleFileName.replace(/\.module\.ts$/, "");
}
function findGetModulesFunction(sf: import("ts-morph").SourceFile) {
  return sf
    .getFunctions()
    .find((fn) => fn.isExported() && !!fn.getName() && /^get\w+Modules$/.test(fn.getName()!));
}
/**
 * @param {string} compositionIndexPath
 * @param {{ applicationPackageKebab: string, moduleFileName: string, propertyKey: string }} opts
 * @returns {string} new file content (caller writes)
 */
interface WireApplicationModuleOpts {
  applicationPackageKebab: string;
  moduleFileName: string;
  propertyKey: string;
}

function wireApplicationModuleIntoCompositionIndex(
  compositionIndexPath: string,
  opts: WireApplicationModuleOpts
) {
  const { applicationPackageKebab, moduleFileName, propertyKey } = opts;
  const packagesDir = path.join(path.dirname(compositionIndexPath), "..", "..", "..");
  const moduleAbs = path.normalize(
    path.join(packagesDir, "application", applicationPackageKebab, "src", "modules", moduleFileName)
  );
  if (!fs.existsSync(moduleAbs)) {
    throw new Error(`Module file not found: ${moduleAbs}`);
  }
  const appPkgJsonPath = path.normalize(
    path.join(packagesDir, "application", applicationPackageKebab, "package.json")
  );
  const appPkg = JSON.parse(fs.readFileSync(path.normalize(appPkgJsonPath), "utf8"));
  const exports = appPkg.exports && typeof appPkg.exports === "object" ? appPkg.exports : {};
  if (!exports["./modules"]) {
    throw new Error(
      `@application/${applicationPackageKebab} has no "./modules" export in package.json. Run application-module (or add the export) first.`
    );
  }
  const className = parseExportedModuleClassName(moduleAbs);
  const importLine = `import { ${className} } from "@application/${applicationPackageKebab}/modules";`;
  let text = fs.readFileSync(compositionIndexPath, "utf8");
  if (text.includes(`new ${className}(`)) {
    throw new Error(`${className} already appears wired in ${compositionIndexPath}`);
  }
  text = appendImportsIfMissing(text, [importLine]);
  const project = createPlopMorphProject({ useInMemoryFileSystem: true });
  const sf = project.createSourceFile(compositionIndexPath, text, { overwrite: true });
  const fn = findGetModulesFunction(sf);
  const fnBodyCandidate = fn?.getBody();
  const fnBody = fnBodyCandidate && Node.isBlock(fnBodyCandidate) ? fnBodyCandidate : undefined;
  if (!fn || !fnBody) {
    throw new Error(
      `No exported function get*Modules with a block body in ${compositionIndexPath}`
    );
  }
  const infraVar = findInfraVariableName(fn);
  const returnStatements = fnBody.getStatements().filter(Node.isReturnStatement);
  const retStmt = returnStatements.at(-1);
  const retExpr = retStmt?.getExpression();
  if (!retExpr || !Node.isObjectLiteralExpression(retExpr)) {
    throw new Error(
      `Expected a single return with an object literal in ${fn.getName() ?? "get*Modules"}`
    );
  }
  for (const p of retExpr.getProperties()) {
    if (Node.isPropertyAssignment(p) && p.getName() === propertyKey) {
      throw new Error(`Return object already has property "${propertyKey}"`);
    }
  }
  retExpr.addPropertyAssignment({
    name: propertyKey,
    initializer: `new ${className}(${infraVar})`,
  });
  return `${sf.getFullText().replace(/\n+$/, "")}\n`;
}
/**
 * Ensure composition package.json depends on @application/<pkg> workspace:*.
 * @param {string} compositionPackageJsonPath
 * @param {string} applicationPackageKebab
 */
function ensureCompositionDependsOnApplication(
  compositionPackageJsonPath: string,
  applicationPackageKebab: string
) {
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  const depName = `@application/${applicationPackageKebab}`;
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (pkg.dependencies[depName]) {
    return;
  }
  pkg.dependencies[depName] = "workspace:*";
  const keys = Object.keys(pkg.dependencies).sort();
  const sorted: Record<string, string> = {};
  for (const k of keys) sorted[k] = pkg.dependencies[k];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
export const defaultPropertyKeyFromModuleFile = (moduleFileName: string) =>
  toCamelCase(moduleFileBaseKebab(moduleFileName));
export {
  wireApplicationModuleIntoCompositionIndex,
  ensureCompositionDependsOnApplication,
  parseExportedModuleClassName,
  moduleFileBaseKebab,
};
