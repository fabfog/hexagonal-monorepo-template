"use strict";

const fs = require("fs");
const ts = require("typescript");

/**
 * @param {ts.SourceFile} sf
 * @returns {ts.ClassDeclaration | undefined}
 */
function findInfrastructureProviderClass(sf) {
  /** @type {ts.ClassDeclaration | undefined} */
  let found;
  for (const stmt of sf.statements) {
    if (
      !ts.isClassDeclaration(stmt) ||
      !stmt.name ||
      !stmt.name.text.endsWith("InfrastructureProvider")
    ) {
      continue;
    }
    if (found) {
      throw new Error(
        `Multiple *InfrastructureProvider classes in ${sf.fileName}; expected exactly one.`
      );
    }
    found = stmt;
  }
  return found;
}

/**
 * @param {ts.ClassDeclaration} classDecl
 * @returns {ts.MethodDeclaration | undefined}
 */
function findGetForContextMethod(classDecl) {
  for (const member of classDecl.members) {
    if (!ts.isMethodDeclaration(member)) continue;
    if (member.name && ts.isIdentifier(member.name) && member.name.text === "getForContext") {
      return member;
    }
  }
  return undefined;
}

/**
 * @param {ts.Block} body
 * @returns {{ retStmt: ts.ReturnStatement, obj: ts.ObjectLiteralExpression }}
 */
function findReturnObjectLiteral(body) {
  /** @type {ts.ReturnStatement | undefined} */
  let ret;
  for (const st of body.statements) {
    if (ts.isReturnStatement(st)) ret = st;
  }
  if (!ret?.expression || !ts.isObjectLiteralExpression(ret.expression)) {
    throw new Error(
      "Expected getForContext to end with `return { ... }` (single object literal return)."
    );
  }
  return { retStmt: ret, obj: ret.expression };
}

/**
 * @param {ts.ClassElement[]} members
 * @param {string[]} memberNames
 */
function assertNoConflictingMembers(members, memberNames) {
  const blocked = new Set(memberNames.filter(Boolean));
  for (const m of members) {
    const n =
      ts.isMethodDeclaration(m) || ts.isPropertyDeclaration(m) || ts.isGetAccessorDeclaration(m);
    if (!n || !m.name || !ts.isIdentifier(m.name)) continue;
    const t = m.name.text;
    if (blocked.has(t)) {
      throw new Error(`Class already has a member named "${t}".`);
    }
  }
}

/**
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} propName
 */
function assertNoReturnPropertyConflict(obj, propName) {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === propName) {
      throw new Error(`getForContext return object already has property "${propName}"`);
    }
  }
}

/**
 * @param {string} compositionInfrastructurePath
 * @returns {{
 *   text: string,
 *   sourceFile: ts.SourceFile,
 *   providerClass: ts.ClassDeclaration,
 *   getForContext: ts.MethodDeclaration,
 *   getForContextBody: ts.Block,
 *   retStmt: ts.ReturnStatement,
 *   returnObject: ts.ObjectLiteralExpression,
 *   ctxParamName: string,
 * }}
 */
function loadCompositionInfrastructureAst(compositionInfrastructurePath) {
  const text = fs.readFileSync(compositionInfrastructurePath, "utf8");
  const sourceFile = ts.createSourceFile(
    compositionInfrastructurePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const providerClass = findInfrastructureProviderClass(sourceFile);
  if (!providerClass || !providerClass.name) {
    throw new Error(
      `No exported *InfrastructureProvider class in ${compositionInfrastructurePath}`
    );
  }

  const getForContext = findGetForContextMethod(providerClass);
  if (!getForContext?.body || !ts.isBlock(getForContext.body)) {
    throw new Error(`getForContext must have a block body in ${compositionInfrastructurePath}`);
  }

  const ctxParam = getForContext.parameters[0];
  const ctxParamName = ctxParam && ts.isIdentifier(ctxParam.name) ? ctxParam.name.text : "ctx";
  const { retStmt, obj } = findReturnObjectLiteral(getForContext.body);

  return {
    text,
    sourceFile,
    providerClass,
    getForContext,
    getForContextBody: getForContext.body,
    retStmt,
    returnObject: obj,
    ctxParamName,
  };
}

/**
 * @param {{
 *   sourceFile: ts.SourceFile,
 *   providerClass: ts.ClassDeclaration,
 *   getForContext: ts.MethodDeclaration,
 *   getForContextBody: ts.Block,
 *   retStmt: ts.ReturnStatement,
 *   returnObject: ts.ObjectLiteralExpression,
 *   insertedMembers?: ts.ClassElement[],
 *   appendedProperty?: ts.ObjectLiteralElementLike,
 * }} ctx
 * @returns {string}
 */
function printUpdatedCompositionInfrastructure(ctx) {
  const insertedMembers = ctx.insertedMembers || [];
  let nextReturnObject = ctx.returnObject;
  if (ctx.appendedProperty) {
    nextReturnObject = ts.factory.updateObjectLiteralExpression(ctx.returnObject, [
      ...ctx.returnObject.properties,
      ctx.appendedProperty,
    ]);
  }

  const nextReturn = ts.factory.updateReturnStatement(ctx.retStmt, nextReturnObject);
  const retIndex = ctx.getForContextBody.statements.indexOf(ctx.retStmt);
  const nextBodyStatements = ctx.getForContextBody.statements.map((stmt, index) =>
    index === retIndex ? nextReturn : stmt
  );
  const nextGetForContextBody = ts.factory.updateBlock(ctx.getForContextBody, nextBodyStatements);
  const nextGetForContext = ts.factory.updateMethodDeclaration(
    ctx.getForContext,
    ctx.getForContext.modifiers,
    ctx.getForContext.asteriskToken,
    ctx.getForContext.name,
    ctx.getForContext.questionToken,
    ctx.getForContext.typeParameters,
    ctx.getForContext.parameters,
    ctx.getForContext.type,
    nextGetForContextBody
  );

  const getForIndex = ctx.providerClass.members.indexOf(ctx.getForContext);
  if (getForIndex === -1) {
    throw new Error("Internal error: getForContext not found in class members array");
  }

  const nextMembers = [
    ...ctx.providerClass.members.slice(0, getForIndex),
    ...insertedMembers,
    ...ctx.providerClass.members.slice(getForIndex),
  ].map((member) => (member === ctx.getForContext ? nextGetForContext : member));

  const nextClass = ts.factory.updateClassDeclaration(
    ctx.providerClass,
    ctx.providerClass.modifiers,
    ctx.providerClass.name,
    ctx.providerClass.typeParameters,
    ctx.providerClass.heritageClauses,
    nextMembers
  );

  const nextStatements = ctx.sourceFile.statements.map((stmt) =>
    stmt === ctx.providerClass ? nextClass : stmt
  );

  const transformer = (transformContext) => (sourceFile) => {
    function visit(node) {
      if (node === ctx.sourceFile) {
        return transformContext.factory.updateSourceFile(sourceFile, nextStatements);
      }
      return ts.visitEachChild(node, visit, transformContext);
    }
    return visit(sourceFile);
  };

  const result = ts.transform(ctx.sourceFile, [transformer]);
  const transformed = result.transformed[0];
  result.dispose();

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });
  return `${printer.printFile(transformed).replace(/\n+$/, "")}\n`;
}

module.exports = {
  ts,
  findInfrastructureProviderClass,
  findGetForContextMethod,
  findReturnObjectLiteral,
  assertNoConflictingMembers,
  assertNoReturnPropertyConflict,
  loadCompositionInfrastructureAst,
  printUpdatedCompositionInfrastructure,
};
