"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { toKebabCase, toPascalCase } = require("./casing.cjs");
const { packagePath } = require("./packages.cjs");

/**
 * @param {string} absDir
 * @returns {string[]}
 */
function collectTypeScriptSourceFiles(absDir) {
  if (!fs.existsSync(absDir)) {
    return [];
  }
  /** @type {string[]} */
  const out = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        walk(p);
      } else if (e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) {
        out.push(p);
      }
    }
  }
  walk(absDir);
  return out;
}

/**
 * `paths` + `baseUrl: repoRoot` so the checker resolves hoisted `zod` and workspace `@domain/*`
 * imports (Plop often runs before a package-local `node_modules` exists).
 * @param {string} repoRoot
 * @param {string} domainPackageDir absolute `packages/domain/<name>`
 * @returns {Record<string, string[]>}
 */
function buildCompilerPathsForDomainPackage(repoRoot, domainPackageDir) {
  /** @type {Record<string, string[]>} */
  const paths = {};
  const pkgJsonPath = path.join(domainPackageDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) {
    return paths;
  }
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  } catch {
    return paths;
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const depName of Object.keys(deps || {})) {
    if (!depName.startsWith("@domain/")) continue;
    const short = depName.slice("@domain/".length);
    const srcRoot = path.join(repoRoot, "packages", "domain", short, "src");
    if (!fs.existsSync(srcRoot)) continue;
    const rel = path.relative(repoRoot, srcRoot).replace(/\\/g, "/");
    paths[`${depName}/*`] = [`${rel}/*`];
  }

  try {
    const zodPkg = require.resolve("zod/package.json", {
      paths: [domainPackageDir, repoRoot],
    });
    const zodRoot = path.dirname(zodPkg);
    const zrel = path.relative(repoRoot, zodRoot).replace(/\\/g, "/");
    paths.zod = [zrel, `${zrel}/*`];
  } catch {
    const fallback = path.join(repoRoot, "node_modules", "zod");
    if (fs.existsSync(fallback)) {
      const zrel = path.relative(repoRoot, fallback).replace(/\\/g, "/");
      paths.zod = [zrel, `${zrel}/*`];
    }
  }
  return paths;
}

/**
 * @param {ts.ClassDeclaration} classDecl
 * @returns {ts.MethodDeclaration | undefined}
 */
function findToSnapshotImplementation(classDecl) {
  /** @type {ts.MethodDeclaration | undefined} */
  let withBody;
  for (const member of classDecl.members) {
    if (!ts.isMethodDeclaration(member)) continue;
    if (!ts.isIdentifier(member.name) || member.name.text !== "toSnapshot") continue;
    if (member.body) withBody = member;
  }
  return withBody;
}

/**
 * @param {ts.SourceFile} sf
 * @param {string} className
 * @returns {ts.ClassDeclaration | undefined}
 */
function findExportedClassDeclaration(sf, className) {
  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt) || stmt.name?.text !== className) continue;
    const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) return stmt;
  }
  return undefined;
}

/**
 * @param {ts.ClassDeclaration} classDecl
 * @returns {ts.ConstructorDeclaration | undefined}
 */
function findConstructorDeclaration(classDecl) {
  for (const member of classDecl.members) {
    if (ts.isConstructorDeclaration(member)) return member;
  }
  return undefined;
}

/**
 * Type of the first constructor parameter (e.g. `TicketProps` on `constructor(props: TicketProps)`).
 * @param {ts.TypeChecker} checker
 * @param {ts.ClassDeclaration} classDecl
 * @returns {ts.Type | undefined}
 */
function getConstructorFirstParameterType(checker, classDecl) {
  const ctor = findConstructorDeclaration(classDecl);
  if (!ctor || ctor.parameters.length === 0) return undefined;
  const p0 = ctor.parameters[0];
  if (!p0.type) return undefined;
  return checker.getTypeFromTypeNode(p0.type);
}

/**
 * @param {string} propName
 */
function defaultStringLiteralForProp(propName) {
  const n = String(propName).toLowerCase();
  if (n.includes("email")) return JSON.stringify("stub@example.com");
  if (n === "slug" || n.endsWith("slug")) return JSON.stringify("stub-slug");
  if (n.includes("url") || n.includes("href")) return JSON.stringify("https://example.test/stub");
  return JSON.stringify(`stub-${propName}`);
}

/**
 * @param {string} fieldName e.g. language, country
 */
function defaultStringForNestedObjectField(fieldName) {
  const n = fieldName.toLowerCase();
  if (n === "language") return JSON.stringify("en");
  if (n === "country") return JSON.stringify("US");
  return JSON.stringify(`stub-${fieldName}`);
}

/**
 * @param {ts.Symbol} symbol
 * @param {string} repoRoot
 * @returns {string} e.g. `@domain/core/value-objects`
 */
function workspaceImportModuleForSymbol(symbol, repoRoot) {
  const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
  if (!decl) {
    throw new Error(
      `Codegen: symbol "${symbol.name}" has no declaration for import path resolution.`
    );
  }
  const file = decl.getSourceFile().fileName.replace(/\\/g, "/");
  const normRoot = repoRoot.replace(/\\/g, "/");
  const rel = path.relative(normRoot, file).replace(/\\/g, "/");
  const m = rel.match(/^packages\/domain\/([^/]+)\/src\/(entities|value-objects)\//);
  if (!m) {
    throw new Error(
      `Codegen: declare "${symbol.name}" under packages/domain/<pkg>/src/entities or value-objects so the mapper test can import it (got "${rel}").`
    );
  }
  const pkg = m[1];
  const slice = m[2];
  return `@domain/${pkg}/${slice}`;
}

/**
 * @param {Map<string, Set<string>>} acc
 * @param {string} module
 * @param {string} name
 */
function addImport(acc, module, name) {
  if (!acc.has(module)) acc.set(module, new Set());
  acc.get(module).add(name);
}

/**
 * @param {ts.Type} objType
 * @param {ts.TypeChecker} checker
 */
function buildPlainObjectLiteralForType(objType, checker) {
  const apparent = checker.getApparentType(objType);
  const props = checker.getPropertiesOfType(apparent);
  if (props.length === 0) {
    return "{}";
  }
  const parts = [];
  for (const p of props) {
    const n = p.getName();
    if (n.startsWith("__")) continue;
    const optional = (p.getFlags() & ts.SymbolFlags.Optional) !== 0;
    if (optional) continue;
    const pt = checker.getTypeOfPropertyOfType(apparent, n);
    if (!pt) continue;
    const ps = checker.typeToString(pt);
    if (ps === "string") {
      parts.push(`${n}: ${defaultStringForNestedObjectField(n)}`);
    } else if (ps === "number") {
      parts.push(`${n}: 7`);
    } else if (ps === "boolean") {
      parts.push(`${n}: true`);
    } else {
      throw new Error(
        `Codegen: unsupported nested property "${n}" type "${ps}" in constructor arg object literal — use primitives or extend entity-to-dto-map-codegen.cjs.`
      );
    }
  }
  return `{ ${parts.join(", ")} }`;
}

/**
 * @param {string} propName
 * @param {ts.Type} propType
 * @param {ts.TypeChecker} checker
 * @param {string} repoRoot
 * @param {Map<string, Set<string>>} importAcc
 * @returns {string}
 */
function buildConstructorArgExpression(propName, propType, checker, repoRoot, importAcc) {
  const t = checker.getApparentType(propType);
  const typeStr = checker.typeToString(t);
  const norm = typeStr.toLowerCase();

  if (norm === "string") {
    return defaultStringLiteralForProp(propName);
  }
  if (norm === "number") {
    return "42";
  }
  if (norm === "boolean") {
    return "true";
  }
  if (norm === "bigint") {
    return "9n";
  }
  if (norm === "date" || typeStr.includes("Date")) {
    return "new Date('2020-01-01T00:00:00.000Z')";
  }

  let sigs = t.getConstructSignatures();
  if (sigs.length === 0 && t.symbol) {
    const ctorSide = checker.getTypeOfSymbol(t.symbol);
    if (ctorSide) {
      sigs = ctorSide.getConstructSignatures();
    }
  }
  if (sigs.length === 0) {
    throw new Error(
      `Codegen: cannot scaffold constructor arg for property "${propName}" (type "${typeStr}") — no construct signatures.`
    );
  }

  const sig = sigs[0];
  const decl = sig.declaration;
  if (
    !ts.isConstructorDeclaration(decl) ||
    !ts.isClassDeclaration(decl.parent) ||
    !decl.parent.name
  ) {
    throw new Error(
      `Codegen: could not resolve class for constructor of "${propName}" (${typeStr}).`
    );
  }
  const classSym = checker.getSymbolAtLocation(decl.parent.name);
  if (!classSym) {
    throw new Error(`Codegen: missing class symbol for "${propName}" (${typeStr}).`);
  }
  const className = classSym.getEscapedName ? classSym.getEscapedName() : classSym.name;

  const ctorDecl = decl;
  if (ctorDecl.parameters.length === 0) {
    const mod = workspaceImportModuleForSymbol(classSym, repoRoot);
    addImport(importAcc, mod, className);
    return `new ${className}()`;
  }

  if (ctorDecl.parameters.length !== 1) {
    throw new Error(
      `Codegen: ${className} constructor must have 0 or 1 parameter to scaffold mapper tests (property "${propName}").`
    );
  }

  const p0 = ctorDecl.parameters[0];
  const paramType = checker.getTypeAtLocation(p0);
  const mod = workspaceImportModuleForSymbol(classSym, repoRoot);
  addImport(importAcc, mod, className);

  const paramStr = checker.typeToString(paramType);
  if (
    paramStr === "string" ||
    paramStr === "number" ||
    paramStr === "boolean" ||
    paramStr === "bigint"
  ) {
    if (paramStr === "string") return `new ${className}(${defaultStringLiteralForProp(propName)})`;
    if (paramStr === "number") return `new ${className}(42)`;
    if (paramStr === "boolean") return `new ${className}(true)`;
    return `new ${className}(9n)`;
  }

  if (paramStr === "Date" || paramStr.includes("Date")) {
    return `new ${className}(new Date('2020-01-01T00:00:00.000Z'))`;
  }

  const inner = buildPlainObjectLiteralForType(paramType, checker);
  return `new ${className}(${inner})`;
}

/**
 * @param {ts.TypeChecker} checker
 * @param {ts.ClassDeclaration} classDecl
 * @param {string} entityPascal
 * @param {string} entityClassName
 * @param {string[]} sortedFieldNames from toSnapshot / DTO order
 * @param {string} entityDomainPackage
 * @param {string} repoRoot
 * @returns {{ importAcc: Map<string, Set<string>>, entityConstruction: string }}
 */
function buildEntityTestConstruction(
  checker,
  classDecl,
  entityPascal,
  entityClassName,
  sortedFieldNames,
  entityDomainPackage,
  repoRoot
) {
  /** @type {Map<string, Set<string>>} */
  const importAcc = new Map();
  const entitiesMod = `@domain/${entityDomainPackage}/entities`;
  addImport(importAcc, entitiesMod, entityClassName);

  const ctor = findConstructorDeclaration(classDecl);
  if (!ctor) {
    throw new Error(
      `Codegen: ${entityClassName} has no constructor — cannot scaffold a real entity in the mapper test.`
    );
  }

  if (ctor.parameters.length === 0) {
    if (sortedFieldNames.length > 0) {
      throw new Error(
        `Codegen: ${entityClassName} has a zero-arg constructor but toSnapshot() exposes properties — add a constructor parameter typed as *Props.`
      );
    }
    return { importAcc, entityConstruction: `const entity = new ${entityClassName}();` };
  }

  const ctorPropsType = getConstructorFirstParameterType(checker, classDecl);
  if (!ctorPropsType) {
    throw new Error(
      `Codegen: add an explicit type to ${entityClassName}'s constructor first parameter (e.g. \`constructor(props: ${entityPascal}Props)\`) so the mapper test can call \`new ${entityClassName}({ ... })\` without type assertions.`
    );
  }

  const lines = [];
  for (const name of sortedFieldNames) {
    const sym = checker.getPropertyOfType(ctorPropsType, name);
    if (!sym) {
      throw new Error(
        `Codegen: property "${name}" appears on toSnapshot() but not on the constructor parameter type — align ${entityPascal}Props (or the constructor annotation) with the snapshot shape.`
      );
    }
    const optional = (sym.getFlags() & ts.SymbolFlags.Optional) !== 0;
    if (optional) {
      throw new Error(
        `Codegen: optional snapshot property "${name}" is not supported in generated mapper tests yet — make it required on ${entityPascal}Props or adjust the test manually.`
      );
    }
    const pt = checker.getTypeOfPropertyOfType(ctorPropsType, name);
    if (!pt) {
      throw new Error(`Codegen: could not resolve type for constructor prop "${name}".`);
    }
    const expr = buildConstructorArgExpression(name, pt, checker, repoRoot, importAcc);
    lines.push(`      ${name}: ${expr},`);
  }

  const objectBody = lines.length > 0 ? `\n${lines.join("\n")}\n    ` : "";
  const entityConstruction = `const entity = new ${entityClassName}({${objectBody}});`;

  return { importAcc, entityConstruction };
}

/**
 * @param {Map<string, Set<string>>} importAcc
 * @param {string} entityKebab
 * @param {string} fn mapXToDTO
 */
function formatTestImportLines(importAcc, entityKebab, fn) {
  /** @type {string[]} */
  const out = [];
  out.push(`import { describe, it, expect } from "vitest";`);
  const mods = [...importAcc.keys()].sort((a, b) => a.localeCompare(b));
  for (const mod of mods) {
    const names = [...importAcc.get(mod)].sort((a, b) => a.localeCompare(b));
    out.push(`import { ${names.join(", ")} } from "${mod}";`);
  }
  if (entityKebab && fn) {
    out.push(`import { ${fn} } from "./${entityKebab}.mapper";`);
  }
  return out;
}

/**
 * @param {ts.TypeChecker} checker
 * @param {ts.ClassDeclaration} classDecl
 * @param {string} entityClassName
 */
function buildEmptyEntityTestConstruction(
  checker,
  classDecl,
  entityClassName,
  entityDomainPackage
) {
  /** @type {Map<string, Set<string>>} */
  const importAcc = new Map();
  addImport(importAcc, `@domain/${entityDomainPackage}/entities`, entityClassName);
  const ctor = findConstructorDeclaration(classDecl);
  if (ctor && ctor.parameters.length === 0) {
    return {
      importAcc,
      entityConstruction: `const entity = new ${entityClassName}();`,
    };
  }
  const ctorPropsType = ctor ? getConstructorFirstParameterType(checker, classDecl) : undefined;
  if (ctorPropsType) {
    const props = checker
      .getPropertiesOfType(ctorPropsType)
      .filter((p) => !p.getName().startsWith("__"));
    const allOptional = props.every((p) => (p.getFlags() & ts.SymbolFlags.Optional) !== 0);
    if (props.length === 0 || allOptional) {
      return {
        importAcc,
        entityConstruction: `const entity = new ${entityClassName}({});`,
      };
    }
  }
  throw new Error(
    `Codegen: empty toSnapshot() but ${entityClassName} requires constructor arguments — cannot scaffold mapper test without \`as unknown\`; add optional props or a no-arg constructor.`
  );
}

/**
 * @param {ts.Type} t
 * @param {ts.TypeChecker} checker
 * @returns {ts.Type | undefined}
 */
function typeOfValueGetter(t, checker) {
  const apparent = checker.getApparentType(t);
  const sym = apparent.getProperty("value");
  if (!sym) return undefined;
  return checker.getTypeOfSymbol(sym);
}

/**
 * @param {ts.Type} t
 * @param {ts.TypeChecker} checker
 * @param {string} methodName
 * @returns {ts.Type | undefined}
 */
function returnTypeOfZeroArgMethod(t, checker, methodName) {
  const apparent = checker.getApparentType(t);
  const sym = apparent.getProperty(methodName);
  if (!sym) return undefined;
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  if (!decl) return undefined;
  if (ts.isMethodDeclaration(decl) || ts.isMethodSignature(decl)) {
    const sig = checker.getSignatureFromDeclaration(decl);
    if (sig && sig.parameters.length === 0) {
      return checker.getReturnTypeOfSignature(sig);
    }
  }
  return undefined;
}

/**
 * Prefer a plain object literal shape in DTOs when the type is `Readonly<{ ... }>`.
 * @param {string} typeStr
 */
function simplifyReadonlyObjectWrapper(typeStr) {
  const trimmed = typeStr.trim();
  const m = trimmed.match(/^Readonly<\s*(\{[\s\S]*\})\s*>$/);
  if (m) return m[1].trim();
  return trimmed;
}

/**
 * DTO interfaces are descriptive snapshots: drop `readonly` on object properties so they match
 * plain fields like `string` (TypeScript often prints `readonly` from `getProps(): Readonly<...>`).
 * Preserves built-ins such as `ReadonlyArray<` / `ReadonlyMap<` / `ReadonlySet<`.
 * @param {string} typeStr
 */
function stripReadonlyPropertyModifiersFromDtoType(typeStr) {
  /** @type {string[]} */
  const protectedChunks = [];
  let s = typeStr.replace(/ReadonlyArray<|ReadonlyMap<|ReadonlySet</g, (match) => {
    const i = protectedChunks.length;
    protectedChunks.push(match);
    return `§§${i}§§`;
  });
  s = s.replace(/\breadonly\s+/g, "");
  for (let i = 0; i < protectedChunks.length; i++) {
    s = s.split(`§§${i}§§`).join(protectedChunks[i]);
  }
  return s;
}

/**
 * @param {string} typeStr
 */
function normalizeGetPropsDtoTypeString(typeStr) {
  return stripReadonlyPropertyModifiersFromDtoType(simplifyReadonlyObjectWrapper(typeStr));
}

/**
 * Build test stub / expected literal for an object type (VO props / getProps result).
 * @param {ts.Type} objectLike
 * @param {ts.TypeChecker} checker
 * @returns {{ stubSnapshotExpr: string, expectedLiteral: string } | null}
 */
function objectLiteralStubForType(objectLike, checker) {
  const apparent = checker.getApparentType(objectLike);
  const props = checker.getPropertiesOfType(apparent);
  if (props.length === 0) {
    return {
      stubSnapshotExpr: `{ getProps: () => ({}) }`,
      expectedLiteral: `{}`,
    };
  }
  /** @type {string[]} */
  const stubParts = [];
  /** @type {string[]} */
  const expParts = [];
  for (const p of props) {
    const n = p.getName();
    if (n.startsWith("__")) continue;
    const pt = checker.getTypeOfPropertyOfType(apparent, n);
    if (!pt) continue;
    const ps = checker.typeToString(pt);
    let stubVal;
    let expVal;
    if (ps === "string") {
      stubVal = defaultStringForNestedObjectField(n);
      expVal = stubVal;
    } else if (ps === "number") {
      stubVal = "7";
      expVal = "7";
    } else if (ps === "boolean") {
      stubVal = "true";
      expVal = "true";
    } else {
      return null;
    }
    stubParts.push(`${n}: ${stubVal}`);
    expParts.push(`${n}: ${expVal}`);
  }
  return {
    stubSnapshotExpr: `{ getProps: () => ({ ${stubParts.join(", ")} }) }`,
    expectedLiteral: `{ ${expParts.join(", ")} }`,
  };
}

/**
 * @param {string} s
 */
function isPrimitiveTypeString(s) {
  return s === "string" || s === "number" || s === "boolean" || s === "bigint";
}

/**
 * @param {ts.Type} t
 * @param {ts.TypeChecker} checker
 * @param {string} propName
 * @returns {{ dtoType: string, mapperExpr: string, stubSnapshotExpr: string, expectedLiteral: string, mapperKind: 'voValue' | 'voGetProps' | 'direct' | 'todo' }}
 */
function describePropertyMapping(t, checker, propName) {
  const typeStr = checker.typeToString(t);
  const valueT = typeOfValueGetter(t, checker);
  const valueStr = valueT ? checker.typeToString(valueT) : "";

  if (valueT && isPrimitiveTypeString(valueStr)) {
    if (valueStr === "number") {
      return {
        dtoType: valueStr,
        mapperExpr: `snapshot.${propName}.value`,
        stubSnapshotExpr: "{ value: 7 }",
        expectedLiteral: "7",
        mapperKind: "voValue",
      };
    }
    if (valueStr === "boolean") {
      return {
        dtoType: valueStr,
        mapperExpr: `snapshot.${propName}.value`,
        stubSnapshotExpr: "{ value: true }",
        expectedLiteral: "true",
        mapperKind: "voValue",
      };
    }
    const s = JSON.stringify(`stub-${propName}`);
    return {
      dtoType: valueStr,
      mapperExpr: `snapshot.${propName}.value`,
      stubSnapshotExpr: `{ value: ${s} }`,
      expectedLiteral: s,
      mapperKind: "voValue",
    };
  }

  const getPropsReturn = returnTypeOfZeroArgMethod(t, checker, "getProps");
  if (getPropsReturn) {
    const dtoRaw = checker.typeToString(
      getPropsReturn,
      undefined,
      ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias
    );
    const dtoType = normalizeGetPropsDtoTypeString(dtoRaw);
    const stubs = objectLiteralStubForType(getPropsReturn, checker);
    if (stubs) {
      return {
        dtoType,
        mapperExpr: `snapshot.${propName}.getProps()`,
        stubSnapshotExpr: stubs.stubSnapshotExpr,
        expectedLiteral: stubs.expectedLiteral,
        mapperKind: "voGetProps",
      };
    }
  }

  const primNorm = typeStr.toLowerCase();
  if (
    primNorm === "string" ||
    primNorm === "number" ||
    primNorm === "boolean" ||
    primNorm === "bigint"
  ) {
    const lit =
      primNorm === "string"
        ? defaultStringLiteralForProp(propName)
        : primNorm === "number"
          ? "42"
          : primNorm === "boolean"
            ? "true"
            : "9n";
    return {
      dtoType: primNorm === "string" ? "string" : primNorm,
      mapperExpr: `snapshot.${propName}`,
      stubSnapshotExpr: lit,
      expectedLiteral: lit,
      mapperKind: "direct",
    };
  }

  if (typeStr === "Date" || typeStr.includes("Date")) {
    return {
      dtoType: "Date",
      mapperExpr: `snapshot.${propName}`,
      stubSnapshotExpr: "new Date('2020-01-01T00:00:00.000Z')",
      expectedLiteral: "new Date('2020-01-01T00:00:00.000Z')",
      mapperKind: "direct",
    };
  }

  return {
    dtoType: "unknown /* TODO: narrow DTO type */",
    mapperExpr: `snapshot.${propName} /* TODO: map to DTO */`,
    stubSnapshotExpr: "null",
    expectedLiteral: "null",
    mapperKind: "todo",
  };
}

/**
 * @param {string} entityPascal
 * @param {string[]} lines
 */
function buildDtoInterfaceSource(entityPascal, lines) {
  const name = `${entityPascal}DTO`;
  if (lines.length === 0) {
    return `export interface ${name} {}\n`;
  }
  return `export interface ${name} {\n${lines.join("\n")}\n}\n`;
}

/**
 * @param {{
 *   entityPascal: string,
 *   entityKebab: string,
 *   domainPackage: string,
 *   fields: { name: string, optional: boolean, dtoLine: string, mapperLine: string, stubSnapshotExpr: string, expectedLiteral: string, mapperKind: string }[]
 * }} args
 */
function buildMapperSource(args) {
  const { entityPascal, entityKebab, domainPackage, fields } = args;
  const entityClass = `${entityPascal}Entity`;
  const fn = `map${entityPascal}ToDTO`;
  const dtoType = `${entityPascal}DTO`;

  const returnProps =
    fields.length === 0 ? "" : `\n${fields.map((f) => `    ${f.mapperLine},`).join("\n")}\n  `;

  return `import type { ${entityClass} } from '@domain/${domainPackage}/entities';
import type { ${dtoType} } from '../dtos/${entityKebab}.dto';

export function ${fn}(entity: ${entityClass}): ${dtoType} {
  const snapshot = entity.toSnapshot();
  return {${returnProps}};
}
`;
}

/**
 * @param {{
 *   entityPascal: string,
 *   entityKebab: string,
 *   domainPackage: string,
 *   applicationPackage: string,
 *   fields: { name: string, stubSnapshotExpr: string, expectedLiteral: string, mapperKind: string }[],
 *   importAcc: Map<string, Set<string>>,
 *   entityConstruction: string,
 * }} args
 */
function buildMapperTestSource(args) {
  const { entityPascal, entityKebab, fields, importAcc, entityConstruction } = args;
  const fn = `map${entityPascal}ToDTO`;

  const importLines = formatTestImportLines(importAcc, entityKebab, fn);
  const expectedBody = fields.map((f) => `      ${f.name}: ${f.expectedLiteral},`).join("\n");
  const expectedInner = fields.length === 0 ? "" : `\n${expectedBody}\n    `;
  const itTitle = "maps entity fields to the DTO";

  return `${importLines.join("\n")}

describe("${fn}", () => {
  it("${itTitle}", () => {
    ${entityConstruction}
    expect(${fn}(entity)).toEqual({${expectedInner}});
  });
});
`;
}

/**
 * @param {{
 *   repoRoot: string,
 *   domainPackage: string,
 *   entityBasePascal: string,
 *   applicationPackage: string,
 * }} opts
 * @returns {{ dtoSource: string, mapperSource: string, testSource: string }}
 */
function generateApplicationEntityMapperSources(opts) {
  const { repoRoot, domainPackage, entityBasePascal, applicationPackage } = opts;
  const entityPascal = toPascalCase(String(entityBasePascal || "").trim());
  const entityKebab = toKebabCase(entityBasePascal);
  const entityClassName = `${entityPascal}Entity`;
  const domainSrc = packagePath(repoRoot, "domain", domainPackage, "src");
  const entityPath = packagePath(
    repoRoot,
    "domain",
    domainPackage,
    "src",
    "entities",
    `${entityKebab}.entity.ts`
  );

  if (!fs.existsSync(entityPath)) {
    throw new Error(`Entity file not found: ${entityPath}`);
  }

  const rootNames = collectTypeScriptSourceFiles(domainSrc);
  if (rootNames.length === 0) {
    throw new Error(`No TypeScript sources under ${domainSrc}`);
  }

  const domainPackageDir = packagePath(repoRoot, "domain", domainPackage);
  const pathMapping = buildCompilerPathsForDomainPackage(repoRoot, domainPackageDir);

  /** @type {ts.CompilerOptions} */
  const compilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    esModuleInterop: true,
    isolatedModules: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    baseUrl: repoRoot,
    paths: pathMapping,
  };

  const program = ts.createProgram(rootNames, compilerOptions);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entityPath);
  if (!sf) {
    throw new Error(`TypeScript program did not load ${entityPath}`);
  }

  const classDecl = findExportedClassDeclaration(sf, entityClassName);
  if (!classDecl) {
    throw new Error(
      `Could not find exported class ${entityClassName} in ${path.relative(repoRoot, entityPath)}`
    );
  }

  const toSnap = findToSnapshotImplementation(classDecl);
  if (!toSnap) {
    throw new Error(
      `Could not find toSnapshot() implementation on ${entityClassName} in ${path.relative(repoRoot, entityPath)}`
    );
  }

  const sig = checker.getSignatureFromDeclaration(toSnap);
  if (!sig) {
    throw new Error("Could not resolve toSnapshot() type signature");
  }

  const returnType = checker.getReturnTypeOfSignature(sig);
  const props = checker.getPropertiesOfType(returnType);
  const returnTypeLabel = checker.typeToString(returnType);
  if (props.length === 0 && returnTypeLabel === "any") {
    throw new Error(
      `Could not infer properties from ${entityClassName}.toSnapshot() (return type is any). ` +
        "Run `pnpm install` at the repo root so dependencies like zod and workspace @domain/* resolve, then re-run this generator. " +
        "From Plop you can re-run with: pnpm plop application-entity-to-dto-mapper -- --confirm-install"
    );
  }

  /** @type {{ name: string, optional: boolean, order: number }[]} */
  const ordered = [];
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const name = p.getName();
    if (name.startsWith("__@")) continue;
    const optional = (p.getFlags() & ts.SymbolFlags.Optional) !== 0;
    ordered.push({ name, optional, order: i });
  }

  ordered.sort((a, b) => {
    if (a.name === "id") return -1;
    if (b.name === "id") return 1;
    return a.name.localeCompare(b.name);
  });

  /** @type {{ name: string, optional: boolean, dtoLine: string, mapperLine: string, stubSnapshotExpr: string, expectedLiteral: string, mapperKind: string }[]} */
  const fields = [];

  for (const { name, optional } of ordered) {
    const propType = checker.getTypeOfPropertyOfType(returnType, name);
    if (!propType) continue;
    const mapped = describePropertyMapping(propType, checker, name);
    const dtoLine = optional ? `  ${name}?: ${mapped.dtoType};` : `  ${name}: ${mapped.dtoType};`;
    const mapperLine = `${name}: ${mapped.mapperExpr}`;
    fields.push({
      name,
      optional,
      dtoLine,
      mapperLine,
      stubSnapshotExpr: mapped.stubSnapshotExpr,
      expectedLiteral: mapped.expectedLiteral,
      mapperKind: mapped.mapperKind,
    });
  }

  const dtoSource = buildDtoInterfaceSource(
    entityPascal,
    fields.map((f) => f.dtoLine)
  );

  const mapperSource = buildMapperSource({
    entityPascal,
    entityKebab,
    domainPackage,
    fields,
  });

  let testConstruction;
  if (fields.length === 0) {
    testConstruction = buildEmptyEntityTestConstruction(
      checker,
      classDecl,
      entityClassName,
      domainPackage
    );
  } else {
    testConstruction = buildEntityTestConstruction(
      checker,
      classDecl,
      entityPascal,
      entityClassName,
      fields.map((f) => f.name),
      domainPackage,
      repoRoot
    );
  }

  const testSource = buildMapperTestSource({
    entityPascal,
    entityKebab,
    domainPackage,
    applicationPackage,
    fields,
    importAcc: testConstruction.importAcc,
    entityConstruction: testConstruction.entityConstruction,
  });

  return { dtoSource, mapperSource, testSource };
}

module.exports = {
  generateApplicationEntityMapperSources,
};
