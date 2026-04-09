import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { toCamelCase } from "./casing.ts";
import { appendImportsIfMissing } from "./module-wire-ast.ts";
/**
 * @param {string} absModulePath
 * @returns {string} exported class name ending in Module
 */
function parseExportedModuleClassName(absModulePath: string) {
  const text = fs.readFileSync(absModulePath, "utf8");
  const sf = ts.createSourceFile(
    absModulePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  /** @type {string | undefined} */
  let found;
  function visit(node: ts.Node) {
    if (
      ts.isClassDeclaration(node) &&
      node.name &&
      node.name.text.endsWith("Module") &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      found = node.name.text;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  if (!found) {
    throw new Error(`No exported *Module class in ${absModulePath}`);
  }
  return found;
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
/**
 * @param {ts.Block} body
 * @param {ts.SourceFile} sf
 * @returns {string}
 */
function findInfraVariableName(body: ts.Block, sf: ts.SourceFile) {
  for (const st of body.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const decl of st.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const initText = decl.initializer.getText(sf);
      if (initText.includes("infrastructureProvider.getForContext")) {
        return decl.name.text;
      }
    }
  }
  throw new Error(
    "Could not find `const <name> = infrastructureProvider.getForContext(ctx)` in get*Modules body."
  );
}
/**
 * @param {ts.SourceFile} sf
 * @returns {ts.FunctionDeclaration | undefined}
 */
function findGetModulesFunction(sf: ts.SourceFile) {
  let found: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      /^get\w+Modules$/.test(node.name.text) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return found;
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
  const sf = ts.createSourceFile(
    compositionIndexPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const fn = findGetModulesFunction(sf);
  if (!fn || !fn.body || !ts.isBlock(fn.body)) {
    throw new Error(
      `No exported function get*Modules with a block body in ${compositionIndexPath}`
    );
  }
  const fnBody = fn.body;
  const infraVar = findInfraVariableName(fnBody, sf);
  /** @type {ts.ReturnStatement | undefined} */
  let retStmt;
  for (const st of fnBody.statements) {
    if (ts.isReturnStatement(st)) retStmt = st;
  }
  if (!retStmt?.expression || !ts.isObjectLiteralExpression(retStmt.expression)) {
    throw new Error(
      `Expected a single return with an object literal in ${fn.name?.text ?? "get*Modules"}`
    );
  }
  const obj = retStmt.expression;
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === propertyKey) {
      throw new Error(`Return object already has property "${propertyKey}"`);
    }
  }
  const newProp = ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier(propertyKey),
    ts.factory.createNewExpression(ts.factory.createIdentifier(className), undefined, [
      ts.factory.createIdentifier(infraVar),
    ])
  );
  const newObj = ts.factory.updateObjectLiteralExpression(obj, [...obj.properties, newProp]);
  const newRet = ts.factory.updateReturnStatement(retStmt, newObj);
  const retIndex = fnBody.statements.indexOf(retStmt);
  const newStmts = fnBody.statements.map((s: ts.Statement, i: number) =>
    i === retIndex ? newRet : s
  );
  const newBody = ts.factory.updateBlock(fnBody, newStmts);
  const newFn = ts.factory.updateFunctionDeclaration(
    fn,
    fn.modifiers,
    fn.asteriskToken,
    fn.name,
    fn.typeParameters,
    fn.parameters,
    fn.type,
    newBody
  );
  const newStatements = sf.statements.map((s: ts.Statement) => (s === fn ? newFn : s));
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => (sourceFile) => {
    if (sourceFile !== sf) {
      return sourceFile;
    }
    return context.factory.updateSourceFile(sourceFile, newStatements);
  };
  const result = ts.transform(sf, [transformer]);
  const transformed = result.transformed[0];
  result.dispose();
  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });
  const out = transformed ?? sf;
  return `${printer.printFile(out).replace(/\n+$/, "")}\n`;
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
