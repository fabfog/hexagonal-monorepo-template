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
 * @returns {import('typescript').MethodDeclaration}
 */
function createHttpClientGetterMethod(getterName: string, ctxParamName: string) {
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
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier("HttpClient"), undefined),
    ts.factory.createBlock(
      [
        ts.factory.createVariableStatement(
          undefined,
          ts.factory.createVariableDeclarationList(
            [
              ts.factory.createVariableDeclaration(
                ts.factory.createIdentifier("httpContext"),
                undefined,
                undefined,
                ts.factory.createObjectLiteralExpression(
                  [
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier("correlationId"),
                      ts.factory.createConditionalExpression(
                        ts.factory.createPropertyAccessChain(
                          ts.factory.createIdentifier(ctxParamName),
                          ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
                          ts.factory.createIdentifier("getCorrelationId")
                        ),
                        ts.factory.createToken(ts.SyntaxKind.QuestionToken),
                        ts.factory.createCallChain(
                          ts.factory.createPropertyAccessChain(
                            ts.factory.createIdentifier(ctxParamName),
                            ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
                            ts.factory.createIdentifier("getCorrelationId")
                          ),
                          undefined,
                          undefined,
                          []
                        ),
                        ts.factory.createToken(ts.SyntaxKind.ColonToken),
                        ts.factory.createIdentifier("undefined")
                      )
                    ),
                  ],
                  true
                )
              ),
            ],
            ts.NodeFlags.Const
          )
        ),
        ts.addSyntheticLeadingComment(
          ts.factory.createReturnStatement(
            ts.factory.createCallExpression(
              ts.factory.createIdentifier("createHttpClientForContext"),
              undefined,
              [
                ts.factory.createIdentifier("httpContext"),
                ts.factory.createObjectLiteralExpression(
                  [
                    ts.factory.createPropertyAssignment(
                      ts.factory.createIdentifier("prefixUrl"),
                      ts.factory.createStringLiteral("FIXME-base-url")
                    ),
                  ],
                  true
                ),
              ]
            )
          ),
          ts.SyntaxKind.SingleLineCommentTrivia,
          " FIXME: set the real prefixUrl and extend HttpContext mapping (auth, tenant, custom headers) if needed.",
          true
        ),
      ],
      true
    )
  );
}
interface HttpClientWireOpts {
  propName: string;
}

/**
 * @param {string} compositionInfrastructurePath
 * @param {HttpClientWireOpts} opts
 * @returns {string}
 */
function wireHttpClientIntoCompositionInfrastructure(
  compositionInfrastructurePath: string,
  opts: HttpClientWireOpts
) {
  const propName = opts.propName;
  const getterName = `get${propName.charAt(0).toUpperCase()}${propName.slice(1)}`;
  const importLines = [
    'import type { HttpClient } from "@infrastructure/lib-http";',
    'import { createHttpClientForContext } from "@infrastructure/lib-http";',
  ];
  let text = fs.readFileSync(compositionInfrastructurePath, "utf8");
  text = appendImportsIfMissing(text, importLines);
  fs.writeFileSync(compositionInfrastructurePath, text, "utf8");
  const ast = loadCompositionInfrastructureAst(compositionInfrastructurePath);
  assertNoConflictingMembers(ast.providerClass.members, [propName, getterName]);
  assertNoReturnPropertyConflict(ast.returnObject, propName);
  const getter = createHttpClientGetterMethod(getterName, ast.ctxParamName);
  return printUpdatedCompositionInfrastructure({
    ...ast,
    insertedMembers: [getter],
    appendedProperty: ts.factory.createPropertyAssignment(
      ts.factory.createIdentifier(propName),
      ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(
          ts.factory.createThis(),
          ts.factory.createIdentifier(getterName)
        ),
        undefined,
        [ts.factory.createIdentifier(ast.ctxParamName)]
      )
    ),
  });
}
/**
 * @param {string} compositionPackageJsonPath
 */
function ensureCompositionDependsOnHttpLib(compositionPackageJsonPath: string) {
  const raw = fs.readFileSync(compositionPackageJsonPath, "utf8");
  const pkg = JSON.parse(raw);
  if (!pkg.dependencies || typeof pkg.dependencies !== "object") {
    pkg.dependencies = {};
  }
  if (!pkg.dependencies["@infrastructure/lib-http"]) {
    pkg.dependencies["@infrastructure/lib-http"] = "workspace:*";
  }
  const keys = Object.keys(pkg.dependencies).sort();
  /** @type {Record<string, string>} */
  const sorted: Record<string, string> = {};
  for (const key of keys) sorted[key] = pkg.dependencies[key];
  pkg.dependencies = sorted;
  fs.writeFileSync(compositionPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
export { wireHttpClientIntoCompositionInfrastructure, ensureCompositionDependsOnHttpLib };
