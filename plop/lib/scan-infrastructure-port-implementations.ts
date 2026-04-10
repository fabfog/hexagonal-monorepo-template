import fs from "node:fs";
import path from "node:path";
import type { ClassDeclaration, SourceFile } from "ts-morph";
import { createPlopMorphProject } from "./ts-morph-project.ts";
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
function countRequiredConstructorParameters(classDecl: ClassDeclaration) {
  const ctor = classDecl.getConstructors()[0];
  if (!ctor) {
    return 0;
  }
  let n = 0;
  for (const p of ctor.getParameters()) {
    if (p.isRestParameter()) continue;
    if (p.isOptional()) continue;
    n++;
  }
  return n;
}
/**
 * True if `name` looks like an application port contract (normal or interaction).
 * @param {string} name
 */
function isPortInterfaceName(name: string) {
  return /(?:InteractionPort|Port)$/.test(name);
}
function findImportModuleForIdentifier(sf: SourceFile, identifierText: string) {
  for (const decl of sf.getImportDeclarations()) {
    const moduleSpecifier = decl.getModuleSpecifierValue();
    if (!moduleSpecifier) continue;

    const defaultImport = decl.getDefaultImport()?.getText();
    if (defaultImport === identifierText) {
      return { moduleSpecifier, isTypeOnly: decl.isTypeOnly() };
    }

    for (const namedImport of decl.getNamedImports()) {
      const importName = namedImport.getNameNode().getText();
      const aliasName = namedImport.getAliasNode()?.getText();
      if (importName === identifierText || aliasName === identifierText) {
        return { moduleSpecifier, isTypeOnly: decl.isTypeOnly() || namedImport.isTypeOnly() };
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
  const project = createPlopMorphProject({ useInMemoryFileSystem: true });
  const out: PortImplementationChoice[] = [];
  for (const abs of files) {
    const text = fs.readFileSync(abs, "utf8");
    const sf = project.createSourceFile(abs, text, { overwrite: true });
    for (const classDecl of sf.getClasses()) {
      const className = classDecl.getName();
      if (!className) continue;
      if (!classDecl.isExported()) continue;
      for (const impl of classDecl.getImplements()) {
        const portName = impl.getText();
        if (!isPortInterfaceName(portName)) continue;
        const rel = path.relative(srcRoot, abs).replace(/\\/g, "/");
        out.push({
          className,
          portInterfaceName: portName,
          relativePath: rel,
          absolutePath: abs,
          infraFolder,
          npmPackageName,
          requiredConstructorParams: countRequiredConstructorParameters(classDecl),
        });
      }
    }
  }
  return out;
}
export { scanPortImplementations, walkTsSourceFiles, findImportModuleForIdentifier };
