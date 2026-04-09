import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkTsSourceFiles(dir: string) {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules") continue;
        stack.push(full);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(".ts")) continue;
      if (e.name.endsWith(".test.ts") || e.name.endsWith(".spec.ts")) continue;
      out.push(full);
    }
  }
  return out.sort();
}
/**
 * @param {ts.ClassDeclaration} classDecl
 * @returns {number}
 */
function countRequiredConstructorParameters(classDecl: ts.ClassDeclaration) {
  for (const member of classDecl.members) {
    if (!ts.isConstructorDeclaration(member)) continue;
    let n = 0;
    for (const p of member.parameters) {
      if (p.dotDotDotToken) continue;
      if (p.questionToken || p.initializer) continue;
      n++;
    }
    return n;
  }
  return 0;
}
/**
 * True if `name` looks like an application port contract (normal or interaction).
 * @param {string} name
 */
function isPortInterfaceName(name: string) {
  return /(?:InteractionPort|Port)$/.test(name);
}
/**
 * @param {ts.SourceFile} sf
 * @param {string} identifierText
 * @returns {{ moduleSpecifier: string, isTypeOnly: boolean } | null}
 */
function findImportModuleForIdentifier(sf: ts.SourceFile, identifierText: string) {
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    const spec = stmt.moduleSpecifier;
    if (!ts.isStringLiteral(spec)) continue;
    const mod = spec.text;
    const typeOnly = !!stmt.importClause.isTypeOnly;
    if (stmt.importClause.name && stmt.importClause.name.text === identifierText) {
      return { moduleSpecifier: mod, isTypeOnly: typeOnly };
    }
    const nb = stmt.importClause.namedBindings;
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        const bindName = el.propertyName ? el.propertyName.text : el.name.text;
        if (el.name.text === identifierText || bindName === identifierText) {
          return { moduleSpecifier: mod, isTypeOnly: typeOnly };
        }
      }
    }
  }
  return null;
}
export interface PortImplementationChoice {
  className: string;
  portInterfaceName: string;
  relativePath: string;
  absolutePath: string;
  infraFolder: string;
  npmPackageName: string;
  requiredConstructorParams: number;
}

/**
 * @param {string} repoRoot
 * @param {string} infraFolder e.g. driven-repository-demo-support
 * @returns {PortImplementationChoice[]}
 */
function scanPortImplementations(repoRoot: string, infraFolder: string) {
  const pkgDir = path.join(repoRoot, "packages", "infrastructure", infraFolder);
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return [];
  }
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const npmPackageName = typeof pkgJson.name === "string" ? pkgJson.name : "";
  if (!npmPackageName) {
    return [];
  }
  const srcRoot = path.join(pkgDir, "src");
  const files = walkTsSourceFiles(srcRoot);
  const out: PortImplementationChoice[] = [];
  for (const abs of files) {
    const text = fs.readFileSync(abs, "utf8");
    const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const stmt of sf.statements) {
      if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
      const isExported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!isExported) continue;
      if (!stmt.heritageClauses) continue;
      for (const hc of stmt.heritageClauses) {
        if (hc.token !== ts.SyntaxKind.ImplementsKeyword) continue;
        for (const t of hc.types) {
          const portName = t.expression.getText(sf);
          if (!isPortInterfaceName(portName)) continue;
          const rel = path.relative(srcRoot, abs).replace(/\\/g, "/");
          out.push({
            className: stmt.name.text,
            portInterfaceName: portName,
            relativePath: rel,
            absolutePath: abs,
            infraFolder,
            npmPackageName,
            requiredConstructorParams: countRequiredConstructorParameters(stmt),
          });
        }
      }
    }
  }
  return out;
}
export { scanPortImplementations, walkTsSourceFiles, findImportModuleForIdentifier };
