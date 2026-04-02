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
 * @param {string} s
 */
function isPrimitiveTypeString(s) {
  return s === "string" || s === "number" || s === "boolean" || s === "bigint";
}

/**
 * @param {ts.Type} t
 * @param {ts.TypeChecker} checker
 * @param {string} propName
 * @returns {{ dtoType: string, mapperExpr: string, stubSnapshotExpr: string, expectedLiteral: string, mapperKind: 'voValue' | 'direct' | 'todo' }}
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

  if (
    typeStr === "string" ||
    typeStr === "number" ||
    typeStr === "boolean" ||
    typeStr === "bigint"
  ) {
    const lit =
      typeStr === "string"
        ? JSON.stringify(`s-${propName}`)
        : typeStr === "number"
          ? "42"
          : typeStr === "boolean"
            ? "true"
            : "9n";
    return {
      dtoType: typeStr,
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
 *   fields: { name: string, stubSnapshotExpr: string, expectedLiteral: string, mapperKind: string }[]
 * }} args
 */
function buildMapperTestSource(args) {
  const { entityPascal, entityKebab, domainPackage, fields } = args;
  const entityClass = `${entityPascal}Entity`;
  const fn = `map${entityPascal}ToDTO`;

  if (fields.length === 0) {
    return `import { describe, it, expect } from "vitest";
import { ${fn} } from "./${entityKebab}.mapper";
import type { ${entityClass} } from "@domain/${domainPackage}/entities";

describe("${fn}", () => {
  it("returns an empty DTO for an entity with an empty snapshot", () => {
    const entity = {
      toSnapshot: () => ({}),
    } as unknown as ${entityClass};
    expect(${fn}(entity)).toEqual({});
  });
});
`;
  }

  const snapshotBody = fields.map((f) => `        ${f.name}: ${f.stubSnapshotExpr},`).join("\n");
  const expectedBody = fields.map((f) => `      ${f.name}: ${f.expectedLiteral},`).join("\n");

  return `import { describe, it, expect } from "vitest";
import { ${fn} } from "./${entityKebab}.mapper";
import type { ${entityClass} } from "@domain/${domainPackage}/entities";

describe("${fn}", () => {
  it("maps snapshot fields to the DTO", () => {
    const entity = {
      toSnapshot: () => ({
${snapshotBody}
      }),
    } as unknown as ${entityClass};
    expect(${fn}(entity)).toEqual({
${expectedBody}
    });
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
        "Run `pnpm install` at the repo root so dependencies like zod and workspace @domain/* resolve, then re-run this generator."
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

  const testSource = buildMapperTestSource({
    entityPascal,
    entityKebab,
    domainPackage,
    applicationPackage,
    fields,
  });

  return { dtoSource, mapperSource, testSource };
}

module.exports = {
  generateApplicationEntityMapperSources,
};
