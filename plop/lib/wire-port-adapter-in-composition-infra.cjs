"use strict";

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { toPascalCase } = require("./casing.cjs");
const { appendImportsIfMissing } = require("./module-wire-ast.cjs");
const { findImportModuleForIdentifier } = require("./scan-infrastructure-port-implementations.cjs");

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
 * @param {string} propName
 * @param {string} getterName
 */
function assertNoConflictingMembers(members, propName, getterName) {
  for (const m of members) {
    const n =
      ts.isMethodDeclaration(m) || ts.isPropertyDeclaration(m) || ts.isGetAccessorDeclaration(m);
    if (!n || !m.name || !ts.isIdentifier(m.name)) continue;
    const t = m.name.text;
    if (t === propName) {
      throw new Error(`Class already has a member named "${propName}".`);
    }
    if (t === getterName) {
      throw new Error(`Class already has a member named "${getterName}".`);
    }
  }
}

/**
 * @param {string} adapterFileAbsPath
 * @param {string} portInterfaceName
 * @returns {string} full import line
 */
function buildPortTypeImportLine(adapterFileAbsPath, portInterfaceName) {
  const text = fs.readFileSync(adapterFileAbsPath, "utf8");
  const sf = ts.createSourceFile(
    adapterFileAbsPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const resolved = findImportModuleForIdentifier(sf, portInterfaceName);
  if (!resolved) {
    throw new Error(
      `Could not find an import for "${portInterfaceName}" in ${path.basename(adapterFileAbsPath)}. ` +
        'Add `import type { ... } from "..."` for the port interface so composition can import the type.'
    );
  }
  return `import type { ${portInterfaceName} } from "${resolved.moduleSpecifier}";`;
}

/**
 * @param {string} getterName
 * @param {string} ctxParamName
 * @param {string} portInterfaceName
 * @param {string} adapterClassName
 * @param {boolean} needsConstructorStub
 * @returns {ts.MethodDeclaration}
 */
function createPrivateGetterMethod(
  getterName,
  ctxParamName,
  portInterfaceName,
  adapterClassName,
  needsConstructorStub
) {
  const newExpr = ts.factory.createNewExpression(
    ts.factory.createIdentifier(adapterClassName),
    undefined,
    []
  );
  let ret = ts.factory.createReturnStatement(newExpr);
  if (needsConstructorStub) {
    ret = ts.addSyntheticLeadingComment(
      ret,
      ts.SyntaxKind.SingleLineCommentTrivia,
      ` FIXME: pass the adapter's required constructor deps (e.g. from RequestContext and/or app-scoped fields on this provider). TypeScript should error until this is fixed.`,
      true
    );
  }
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
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(portInterfaceName), undefined),
    ts.factory.createBlock([ret], true)
  );
}

/**
 * @param {string} propName
 * @param {string} portInterfaceName
 * @param {string} adapterClassName
 * @param {boolean} needsConstructorStub
 * @returns {ts.PropertyDeclaration}
 */
function createAppScopedAdapterProperty(
  propName,
  portInterfaceName,
  adapterClassName,
  needsConstructorStub
) {
  let decl = ts.factory.createPropertyDeclaration(
    [
      ts.factory.createModifier(ts.SyntaxKind.PrivateKeyword),
      ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword),
    ],
    ts.factory.createIdentifier(propName),
    undefined,
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(portInterfaceName), undefined),
    ts.factory.createNewExpression(ts.factory.createIdentifier(adapterClassName), undefined, [])
  );
  if (needsConstructorStub) {
    decl = ts.addSyntheticLeadingComment(
      decl,
      ts.SyntaxKind.SingleLineCommentTrivia,
      ` FIXME: composition-wire-port-adapter — \`new ${adapterClassName}()\` in this field initializer is incomplete; pass the adapter's required constructor deps (e.g. from other app-scoped fields on this provider). TypeScript should error until this is fixed.`,
      true
    );
  }
  return decl;
}

/**
 * @param {string} compositionInfrastructurePath
 * @param {{
 *   propName: string,
 *   scope: "app" | "request",
 *   adapterClassName: string,
 *   adapterNpmPackageName: string,
 *   portInterfaceName: string,
 *   adapterFileAbsPath: string,
 *   requiredConstructorParams: number,
 * }} opts
 * @returns {string}
 */
function wirePortAdapterIntoCompositionInfrastructure(compositionInfrastructurePath, opts) {
  const {
    propName,
    scope,
    adapterClassName,
    adapterNpmPackageName,
    portInterfaceName,
    adapterFileAbsPath,
    requiredConstructorParams,
  } = opts;

  const portTypeImportLine = buildPortTypeImportLine(adapterFileAbsPath, portInterfaceName);
  const adapterImportLine = `import { ${adapterClassName} } from "${adapterNpmPackageName}";`;

  let text = fs.readFileSync(compositionInfrastructurePath, "utf8");
  text = appendImportsIfMissing(text, [portTypeImportLine, adapterImportLine]);

  const sf = ts.createSourceFile(
    compositionInfrastructurePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const providerClass = findInfrastructureProviderClass(sf);
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

  const getterName = `get${toPascalCase(propName)}`;
  assertNoConflictingMembers(providerClass.members, propName, getterName);

  const { retStmt, obj } = findReturnObjectLiteral(getForContext.body);
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === propName) {
      throw new Error(`getForContext return object already has property "${propName}"`);
    }
  }

  /** @type {ts.ClassElement} */
  let insertedMember;
  /** @type {ts.Expression} */
  let valueExprForReturn;

  if (scope === "app") {
    insertedMember = createAppScopedAdapterProperty(
      propName,
      portInterfaceName,
      adapterClassName,
      requiredConstructorParams > 0
    );
    valueExprForReturn = ts.factory.createPropertyAccessExpression(
      ts.factory.createThis(),
      ts.factory.createIdentifier(propName)
    );
  } else {
    const needsStub = requiredConstructorParams > 0;
    insertedMember = createPrivateGetterMethod(
      getterName,
      ctxParamName,
      portInterfaceName,
      adapterClassName,
      needsStub
    );
    valueExprForReturn = ts.factory.createCallExpression(
      ts.factory.createPropertyAccessExpression(
        ts.factory.createThis(),
        ts.factory.createIdentifier(getterName)
      ),
      undefined,
      [ts.factory.createIdentifier(ctxParamName)]
    );
  }

  const newPropAssign = ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier(propName),
    valueExprForReturn
  );
  const newObj = ts.factory.updateObjectLiteralExpression(obj, [...obj.properties, newPropAssign]);
  const newRet = ts.factory.updateReturnStatement(retStmt, newObj);
  const retIndex = getForContext.body.statements.indexOf(retStmt);
  const newBodyStmts = getForContext.body.statements.map((s, i) => (i === retIndex ? newRet : s));
  const newGetForContextBody = ts.factory.updateBlock(getForContext.body, newBodyStmts);

  const getForIdx = providerClass.members.indexOf(getForContext);
  if (getForIdx === -1) {
    throw new Error("Internal error: getForContext not found in class members array");
  }
  const newMembers = [
    ...providerClass.members.slice(0, getForIdx),
    insertedMember,
    ...providerClass.members.slice(getForIdx),
  ];
  const newGetForContext = ts.factory.updateMethodDeclaration(
    getForContext,
    getForContext.modifiers,
    getForContext.asteriskToken,
    getForContext.name,
    getForContext.questionToken,
    getForContext.typeParameters,
    getForContext.parameters,
    getForContext.type,
    newGetForContextBody
  );
  const newMembers2 = newMembers.map((m) => (m === getForContext ? newGetForContext : m));

  const newClass = ts.factory.updateClassDeclaration(
    providerClass,
    providerClass.modifiers,
    providerClass.name,
    providerClass.typeParameters,
    providerClass.heritageClauses,
    newMembers2
  );

  const newStatements = sf.statements.map((s) => (s === providerClass ? newClass : s));

  const transformer = (context) => (sourceFile) => {
    function visit(node) {
      if (node === sf) {
        return context.factory.updateSourceFile(sourceFile, newStatements);
      }
      return ts.visitEachChild(node, visit, context);
    }
    return visit(sourceFile);
  };

  const result = ts.transform(sf, [transformer]);
  const transformed = result.transformed[0];
  result.dispose();

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
  });
  return `${printer.printFile(transformed).replace(/\n+$/, "")}\n`;
}

/**
 * Ensure composition package.json depends on @infrastructure/<folder> workspace:*.
 * @param {string} compositionPackageJsonPath
 * @param {string} infrastructureNpmPackageName e.g. @infrastructure/driven-repository-demo-support
 */
function ensureCompositionDependsOnInfrastructure(
  compositionPackageJsonPath,
  infrastructureNpmPackageName
) {
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (pkg.dependencies[infrastructureNpmPackageName]) {
    return;
  }
  pkg.dependencies[infrastructureNpmPackageName] = "workspace:*";
  const keys = Object.keys(pkg.dependencies).sort();
  /** @type {Record<string, string>} */
  const sorted = {};
  for (const k of keys) sorted[k] = pkg.dependencies[k];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

/**
 * If port type import is from @application/…, ensure that dependency exists on composition package.
 * @param {string} compositionPackageJsonPath
 * @param {string} adapterFileAbsPath
 * @param {string} portInterfaceName
 */
function ensureCompositionDependsOnApplicationForPortImport(
  compositionPackageJsonPath,
  adapterFileAbsPath,
  portInterfaceName
) {
  const text = fs.readFileSync(adapterFileAbsPath, "utf8");
  const sf = ts.createSourceFile(
    adapterFileAbsPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const resolved = findImportModuleForIdentifier(sf, portInterfaceName);
  if (!resolved?.moduleSpecifier?.startsWith("@application/")) {
    return;
  }
  const appPkg = resolved.moduleSpecifier.split("/").slice(0, 2).join("/");
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (pkg.dependencies[appPkg]) {
    return;
  }
  pkg.dependencies[appPkg] = "workspace:*";
  const keys = Object.keys(pkg.dependencies).sort();
  /** @type {Record<string, string>} */
  const sorted = {};
  for (const k of keys) sorted[k] = pkg.dependencies[k];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

module.exports = {
  wirePortAdapterIntoCompositionInfrastructure,
  ensureCompositionDependsOnInfrastructure,
  ensureCompositionDependsOnApplicationForPortImport,
};
