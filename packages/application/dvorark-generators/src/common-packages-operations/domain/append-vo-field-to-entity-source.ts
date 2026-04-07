/**
 * Patches an entity source file: adds a Zod schema field and merges VO imports.
 * Uses the TypeScript AST (Compiler API) for structural edits instead of string heuristics.
 */

import ts from "typescript";

export type DomainEntityVoFieldSource = "core" | "local";

export interface AppendVoFieldToEntitySourceField {
  prop: string;
  voClass: string;
  source: DomainEntityVoFieldSource;
}

function getModuleSpecifierText(moduleSpecifier: ts.Expression): string | undefined {
  if (ts.isStringLiteral(moduleSpecifier) || ts.isNoSubstitutionTemplateLiteral(moduleSpecifier)) {
    return moduleSpecifier.text;
  }
  return undefined;
}

/** `z.object(...)` — callee is property access `z.object`. */
function isZObjectCall(callExpr: ts.CallExpression): boolean {
  const callee = ts.skipPartiallyEmittedExpressions(callExpr.expression);
  if (!ts.isPropertyAccessExpression(callee)) {
    return false;
  }
  if (callee.name.text !== "object") {
    return false;
  }
  const left = callee.expression;
  return ts.isIdentifier(left) && left.text === "z";
}

function findEntitySchemaObjectLiteral(
  sourceFile: ts.SourceFile,
  entityPascal: string
): ts.ObjectLiteralExpression | undefined {
  const schemaName = `${entityPascal}Schema`;
  let found: ts.ObjectLiteralExpression | undefined;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== schemaName || !decl.initializer) {
          continue;
        }
        const init = ts.skipPartiallyEmittedExpressions(decl.initializer);
        if (!ts.isCallExpression(init) || !isZObjectCall(init)) {
          continue;
        }
        const arg0 = init.arguments[0];
        if (arg0 && ts.isObjectLiteralExpression(arg0)) {
          found = arg0;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function createVoPropertyAssignment(
  field: AppendVoFieldToEntitySourceField
): ts.PropertyAssignment {
  const voSchemaId = `${field.voClass}Schema`;
  const xParam = ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    ts.factory.createIdentifier("x"),
    undefined,
    undefined,
    undefined
  );
  const arrowBody = ts.factory.createNewExpression(
    ts.factory.createIdentifier(field.voClass),
    undefined,
    [ts.factory.createIdentifier("x")]
  );
  const arrow = ts.factory.createArrowFunction(
    undefined,
    undefined,
    [xParam],
    undefined,
    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    arrowBody
  );
  const transformCall = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(
      ts.factory.createIdentifier(voSchemaId),
      ts.factory.createIdentifier("transform")
    ),
    undefined,
    [arrow]
  );
  return ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier(field.prop),
    transformCall
  );
}

function mergeSortedNames(existing: readonly string[], additions: readonly string[]): string[] {
  return [...new Set([...existing, ...additions])].sort((a, b) => a.localeCompare(b));
}

function mergeNamedImportsIntoDeclaration(
  decl: ts.ImportDeclaration,
  addNames: readonly string[]
): ts.ImportDeclaration | undefined {
  const clause = decl.importClause;
  if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
    return undefined;
  }
  const existing = clause.namedBindings.elements.map((e) => e.name.text);
  const merged = mergeSortedNames(existing, addNames);
  const elements = merged.map((name) =>
    ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name))
  );
  return ts.factory.updateImportDeclaration(
    decl,
    decl.modifiers,
    ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(elements)),
    decl.moduleSpecifier,
    decl.assertClause
  );
}

function createNamedImportDeclaration(
  names: readonly string[],
  modulePath: string
): ts.ImportDeclaration {
  const sorted = mergeSortedNames([], names);
  const elements = sorted.map((name) =>
    ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name))
  );
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports(elements)),
    ts.factory.createStringLiteral(modulePath),
    undefined
  );
}

function findImportInsertIndex(
  statements: readonly ts.Statement[],
  fieldSource: DomainEntityVoFieldSource
): number {
  if (fieldSource === "local") {
    let lastSpecificVo = -1;
    for (let i = 0; i < statements.length; i += 1) {
      const s = statements[i];
      if (!ts.isImportDeclaration(s!) || !s.moduleSpecifier) {
        continue;
      }
      const t = getModuleSpecifierText(s.moduleSpecifier);
      if (t && t.startsWith("../value-objects/") && t.endsWith(".vo") && t !== "../value-objects") {
        lastSpecificVo = i;
      }
    }
    if (lastSpecificVo >= 0) {
      return lastSpecificVo + 1;
    }
  }

  for (let i = 0; i < statements.length; i += 1) {
    const s = statements[i];
    if (!ts.isImportDeclaration(s!) || !s.moduleSpecifier) {
      continue;
    }
    const t = getModuleSpecifierText(s.moduleSpecifier);
    if (t === "zod") {
      return i + 1;
    }
  }

  let lastImport = -1;
  for (let i = 0; i < statements.length; i += 1) {
    if (ts.isImportDeclaration(statements[i]!)) {
      lastImport = i;
    }
  }
  return lastImport + 1;
}

function mergeOrAddImports(
  sourceFile: ts.SourceFile,
  field: AppendVoFieldToEntitySourceField
): ts.SourceFile {
  const addSymbols = [field.voClass, `${field.voClass}Schema`];
  const targetModule = field.source === "core" ? "@domain/core/value-objects" : "../value-objects";

  const statements = [...sourceFile.statements];
  let merged = false;

  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    if (!ts.isImportDeclaration(stmt!) || !stmt.moduleSpecifier) {
      continue;
    }
    const mod = getModuleSpecifierText(stmt.moduleSpecifier);
    if (mod !== targetModule) {
      continue;
    }
    const updated = mergeNamedImportsIntoDeclaration(stmt, addSymbols);
    if (updated) {
      statements[i] = updated;
      merged = true;
    }
    break;
  }

  if (!merged) {
    const newDecl = createNamedImportDeclaration(addSymbols, targetModule);
    const idx = findImportInsertIndex(statements, field.source);
    statements.splice(idx, 0, newDecl);
  }

  return ts.factory.updateSourceFile(sourceFile, statements);
}

function replaceObjectLiteralInSourceFile(
  sourceFile: ts.SourceFile,
  target: ts.ObjectLiteralExpression,
  replacement: ts.ObjectLiteralExpression
): ts.SourceFile {
  const transformer = (context: ts.TransformationContext) => {
    const visit = (node: ts.Node): ts.Node => {
      if (node === target) {
        return replacement;
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sf: ts.SourceFile) => ts.visitNode(sf, visit) as ts.SourceFile;
  };
  const result = ts.transform(sourceFile, [transformer]);
  const out = result.transformed[0] as ts.SourceFile;
  result.dispose();
  return out;
}

/**
 * @throws if the entity schema block cannot be found, or the prop already exists
 */
export function appendVoFieldToEntitySource(
  content: string,
  entityPascal: string,
  field: AppendVoFieldToEntitySourceField
): string {
  const schemaConst = `${entityPascal}Schema`;
  const fileName = "entity.entity.ts";

  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const objectLiteral = findEntitySchemaObjectLiteral(sourceFile, entityPascal);
  if (!objectLiteral) {
    throw new Error(`Could not find export const ${schemaConst} = z.object({ ... })`);
  }

  for (const p of objectLiteral.properties) {
    if (ts.isPropertyAssignment(p)) {
      const name = p.name;
      if (ts.isIdentifier(name) && name.text === field.prop) {
        throw new Error(`Property "${field.prop}" already exists in ${schemaConst}.`);
      }
      if (ts.isStringLiteral(name) && name.text === field.prop) {
        throw new Error(`Property "${field.prop}" already exists in ${schemaConst}.`);
      }
    }
  }

  const newProp = createVoPropertyAssignment(field);
  const newObjectLiteral = ts.factory.updateObjectLiteralExpression(
    objectLiteral,
    ts.factory.createNodeArray([...objectLiteral.properties, newProp])
  );

  let updated = replaceObjectLiteralInSourceFile(sourceFile, objectLiteral, newObjectLiteral);
  updated = mergeOrAddImports(updated, field);

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });

  return printer.printFile(updated);
}
