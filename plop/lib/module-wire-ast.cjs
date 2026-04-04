const fs = require("fs");
const ts = require("typescript");
const { toKebabCase, toCamelCase } = require("./casing.cjs");

/** Property types that are a single identifier (e.g. `ClockPort`) — used to pull `import type` from wired files. */
const SINGLE_IDENTIFIER_TYPE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Flow deps satisfied by an app-scoped "interaction" handle (store, UI bridge, etc.) — not on module Infra.
 * Heuristic: property name `interactionPort` or a single-identifier type ending with `InteractionPort`.
 * @param {{ name: string, typeText: string }} dep
 */
function isFlowInteractionDep(dep) {
  const t = dep.typeText.trim();
  if (dep.name === "interactionPort") return true;
  if (SINGLE_IDENTIFIER_TYPE.test(t) && t.endsWith("InteractionPort")) return true;
  return false;
}

/**
 * Type names to import for module file (Infra props + flow getter parameters).
 * @param {ReturnType<typeof extractWireSpec>} spec
 * @returns {string[]}
 */
function typeIdentifiersNeededForSpec(spec) {
  const ids = [];
  if (spec.kind === "flow") {
    for (const dep of spec.deps) {
      if (!isFlowInteractionDep(dep)) continue;
      const t = dep.typeText.trim();
      if (SINGLE_IDENTIFIER_TYPE.test(t)) ids.push(t);
    }
  }
  return ids;
}

/**
 * @param {ts.SourceFile} sf
 * @param {string} className
 * @returns {ts.ClassDeclaration | undefined}
 */
function findExportedClassDeclaration(sf, className) {
  for (const stmt of sf.statements) {
    if (
      ts.isClassDeclaration(stmt) &&
      stmt.name?.text === className &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      return stmt;
    }
  }
  return undefined;
}

/**
 * @param {ts.ClassDeclaration} classDecl
 * @param {ts.SourceFile} sf
 * @returns {string | null}
 */
function getConstructorFirstParameterTypeName(classDecl, _sf) {
  for (const member of classDecl.members) {
    if (!ts.isConstructorDeclaration(member)) continue;
    const [param] = member.parameters;
    if (!param?.type) return null;
    if (ts.isTypeReferenceNode(param.type) && ts.isIdentifier(param.type.typeName)) {
      return param.type.typeName.text;
    }
    return null;
  }
  return null;
}

/**
 * @param {ts.SourceFile} sf
 * @param {string} interfaceName
 * @returns {{ name: string, typeText: string }[]}
 */
function getInterfacePropertySignatures(sf, interfaceName) {
  /** @type {{ name: string, typeText: string }[]} */
  const out = [];

  function visit(node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member)) continue;
        if (!member.name || !ts.isIdentifier(member.name) || !member.type) continue;
        out.push({
          name: member.name.text,
          typeText: member.type.getText(sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}

/**
 * @param {string} absPath
 * @param {"use-case" | "flow"} kind
 * @param {string} pascalBase e.g. `UpdateTitle` for `UpdateTitleUseCase`
 */
function extractWireSpec(absPath, kind, pascalBase) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`Expected file at ${absPath}`);
  }
  const sourceText = fs.readFileSync(absPath, "utf8");
  const sf = ts.createSourceFile(
    absPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const suffix = kind === "use-case" ? "UseCase" : "Flow";
  const className = `${pascalBase}${suffix}`;
  const classDecl = findExportedClassDeclaration(sf, className);
  if (!classDecl) {
    throw new Error(`No exported class "${className}" in ${absPath}`);
  }
  const depsInterfaceName = getConstructorFirstParameterTypeName(classDecl, sf);
  if (!depsInterfaceName) {
    throw new Error(
      `Could not read constructor deps type (expected first parameter: TypeReference) for "${className}" in ${absPath}`
    );
  }
  const deps = getInterfacePropertySignatures(sf, depsInterfaceName);
  const kebab = toKebabCase(pascalBase);
  const relImport =
    kind === "use-case" ? `../use-cases/${kebab}.use-case` : `../flows/${kebab}.flow`;

  return {
    kind,
    pascalBase,
    className,
    depsInterfaceName,
    deps,
    relImport,
    fieldName: toCamelCase(pascalBase),
    absPath,
  };
}

/**
 * Map local type binding name -> module specifier for type-only (or `import { type X }`) imports.
 * @param {string} absPath
 * @returns {Map<string, { specifier: string, isTypeOnly: boolean }>}
 */
function collectTypeBindingImportsFromFile(absPath) {
  const sourceText = fs.readFileSync(absPath, "utf8");
  const sf = ts.createSourceFile(
    absPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  /** @type {Map<string, { specifier: string, isTypeOnly: boolean }>} */
  const map = new Map();

  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const specifier = stmt.moduleSpecifier.text;
    const clause = stmt.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;

    const clauseTypeOnly = Boolean(clause.isTypeOnly);
    for (const el of clause.namedBindings.elements) {
      const bindingName = el.name.text;
      const typeOnly = clauseTypeOnly || Boolean(el.isTypeOnly);
      if (!typeOnly) continue;
      const prev = map.get(bindingName);
      if (prev && prev.specifier !== specifier) {
        throw new Error(
          `Type "${bindingName}" is imported from conflicting modules in ${absPath} (${prev.specifier} vs ${specifier}).`
        );
      }
      map.set(bindingName, { specifier, isTypeOnly: true });
    }
  }

  return map;
}

/**
 * @param {string[]} absPaths
 */
function mergeTypeBindingImportMaps(absPaths) {
  /** @type {Map<string, { specifier: string, isTypeOnly: boolean }>} */
  const merged = new Map();
  for (const p of absPaths) {
    const m = collectTypeBindingImportsFromFile(p);
    for (const [name, v] of m) {
      const prev = merged.get(name);
      if (prev && prev.specifier !== v.specifier) {
        throw new Error(
          `Type "${name}" is imported from conflicting modules across wired slices (${prev.specifier} vs ${v.specifier}).`
        );
      }
      merged.set(name, v);
    }
  }
  return merged;
}

/**
 * @param {{ name: string, typeText: string }[]} infraProps
 * @returns {string[]}
 */
function listInfraTypeIdentifiers(infraProps) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const { typeText } of infraProps) {
    const t = typeText.trim();
    if (SINGLE_IDENTIFIER_TYPE.test(t)) ids.add(t);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

/**
 * @param {Map<string, { specifier: string, isTypeOnly: boolean }>} bindingToSpec
 * @param {string[]} neededIdentifiers
 * @returns {string[]}
 */
function formatTypeImportLines(bindingToSpec, neededIdentifiers) {
  /** @type {Map<string, string[]>} */
  const bySpecifier = new Map();
  for (const id of neededIdentifiers) {
    const hit = bindingToSpec.get(id);
    if (!hit) {
      throw new Error(
        `Could not find \`import type { ${id} }\` (or \`import { type ${id} }\`) in any wired use-case/flow file. Add it so the module Infra interface can reference ${id}.`
      );
    }
    const list = bySpecifier.get(hit.specifier) || [];
    list.push(id);
    bySpecifier.set(hit.specifier, list);
  }
  return [...bySpecifier.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([spec, names]) => {
      const sorted = [...new Set(names)].sort((a, b) => a.localeCompare(b));
      return `import type { ${sorted.join(", ")} } from "${spec}";`;
    });
}

/**
 * @param {ReturnType<typeof extractWireSpec>[]} specs
 */
function mergeInfraProperties(specs) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const spec of specs) {
    for (const { name, typeText } of spec.deps) {
      if (spec.kind === "flow" && isFlowInteractionDep({ name, typeText })) {
        continue;
      }
      const prev = map.get(name);
      if (prev !== undefined && prev !== typeText) {
        throw new Error(
          `Conflicting infra property "${name}": types differ (${prev} vs ${typeText}). Align dependency interfaces or wire manually.`
        );
      }
      map.set(name, typeText);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, typeText]) => ({ name, typeText }));
}

/**
 * @param {ReturnType<typeof extractWireSpec>} spec
 */
function emitSliceGetter(spec) {
  if (spec.kind === "use-case") {
    const inner =
      spec.deps.length === 0
        ? "{}"
        : `{\n${spec.deps.map((d) => `      ${d.name}: this.infra.${d.name},`).join("\n")}\n    }`;
    return `  public ${spec.fieldName}(): ${spec.className} {
    return new ${spec.className}(${inner});
  }`;
  }

  const interaction = spec.deps.filter(isFlowInteractionDep);
  const params = interaction.map((d) => `${d.name}: ${d.typeText}`).join(", ");
  const objLines =
    spec.deps.length === 0
      ? ""
      : spec.deps
          .map((d) =>
            isFlowInteractionDep(d) ? `      ${d.name},` : `      ${d.name}: this.infra.${d.name},`
          )
          .join("\n");
  const arg = spec.deps.length === 0 ? "{}" : `{\n${objLines}\n    }`;
  return `  public ${spec.fieldName}(${params}): ${spec.className} {
    return new ${spec.className}(${arg});
  }`;
}

/**
 * @param {{ modulePascal: string, specs: ReturnType<typeof extractWireSpec>[] }} opts
 */
function buildWiredModuleSource({ modulePascal, specs }) {
  const infraName = `${modulePascal}Infra`;
  const className = `${modulePascal}Module`;
  const infraProps = mergeInfraProperties(specs);

  const bindingMap = mergeTypeBindingImportMaps(specs.map((s) => s.absPath));
  const infraTypeIds = listInfraTypeIdentifiers(infraProps);
  const interactionTypeIds = specs.flatMap(typeIdentifiersNeededForSpec);
  const allTypeIds = [...new Set([...infraTypeIds, ...interactionTypeIds])].sort((a, b) =>
    a.localeCompare(b)
  );
  const typeImportLines = formatTypeImportLines(bindingMap, allTypeIds);

  const classImportLines = [...specs]
    .sort((a, b) => a.className.localeCompare(b.className))
    .map((s) => `import { ${s.className} } from "${s.relImport}";`);

  const importLines = [...typeImportLines, ...classImportLines];

  const infraBody =
    infraProps.length === 0
      ? ""
      : `\n${infraProps.map((p) => `  ${p.name}: ${p.typeText};`).join("\n")}\n`;

  const getterMethods = [...specs]
    .sort((a, b) => a.fieldName.localeCompare(b.fieldName))
    .map((s) => emitSliceGetter(s));

  return `${importLines.join("\n")}

export interface ${infraName} {${infraBody}}

export class ${className} {
  constructor(private readonly infra: ${infraName}) {}

  ${getterMethods.join("\n\n")}
}
`;
}

/**
 * @param {string} modulePascal
 */
function buildEmptyModuleSource(modulePascal) {
  const infraName = `${modulePascal}Infra`;
  const className = `${modulePascal}Module`;
  return `export interface ${infraName} {
  // Define infrastructure port dependencies that this module's use-cases and flows need to receive
  // from the composition root (semantic adapters implementing application ports).
  // Flow "interaction" deps are passed into get<Flow>() at call site, not listed here.
}

export class ${className} {
  constructor(private readonly infra: ${infraName}) {}

  // Use-cases: add public camelCaseName() methods that return new XxxUseCase({ ...this.infra }).
  // Flows: add public camelCaseName(interactionPort, ...) that return new XxxFlow({ ... }).
}
`;
}

/**
 * @param {string} text
 * @param {number} openBraceIdx index of `{` to match
 */
function indexOfMatchingBrace(text, openBraceIdx) {
  let depth = 0;
  for (let i = openBraceIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * @param {ts.SourceFile} sf
 * @returns {ts.ClassDeclaration | undefined}
 */
function findExportedModuleClass(sf) {
  for (const stmt of sf.statements) {
    if (
      ts.isClassDeclaration(stmt) &&
      stmt.name?.text.endsWith("Module") &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      return stmt;
    }
  }
  return undefined;
}

/**
 * @param {ts.SourceFile} sf
 * @param {string} name
 * @returns {ts.InterfaceDeclaration | undefined}
 */
function findExportedInterfaceDeclaration(sf, name) {
  for (const stmt of sf.statements) {
    if (
      ts.isInterfaceDeclaration(stmt) &&
      stmt.name.text === name &&
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      return stmt;
    }
  }
  return undefined;
}

/**
 * @param {ts.ClassDeclaration} cls
 */
function collectSliceClassNamesFromMethodBodies(cls) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const m of cls.members) {
    if (!ts.isMethodDeclaration(m) || !m.body) continue;
    function visit(node) {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
        const tn = node.expression.text;
        if (tn.endsWith("UseCase") || tn.endsWith("Flow")) {
          out.add(tn);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(m.body);
  }
  return out;
}

/**
 * Class names of already-wired use-cases / flows (getter bodies or legacy `public readonly x: FooUseCase`).
 * @param {string} absPath
 * @returns {Set<string>}
 */
function getWiredSliceClassNamesFromModule(absPath) {
  if (!fs.existsSync(absPath)) {
    return new Set();
  }
  const text = fs.readFileSync(absPath, "utf8");
  const sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const cls = findExportedModuleClass(sf);
  if (!cls) {
    return new Set();
  }
  /** @type {Set<string>} */
  const out = collectSliceClassNamesFromMethodBodies(cls);
  for (const m of cls.members) {
    if (!ts.isPropertyDeclaration(m)) continue;
    const flags = ts.getCombinedModifierFlags(m);
    const isPublic = (flags & ts.ModifierFlags.Public) !== 0;
    const isReadonly = (flags & ts.ModifierFlags.Readonly) !== 0;
    if (!isPublic || !isReadonly) continue;
    if (!m.type || !ts.isTypeReferenceNode(m.type) || !ts.isIdentifier(m.type.typeName)) continue;
    const tn = m.type.typeName.text;
    if (tn.endsWith("UseCase") || tn.endsWith("Flow")) {
      out.add(tn);
    }
  }
  return out;
}

/**
 * @param {ts.ClassDeclaration} cls
 */
function moduleUsesLegacyPublicSliceFields(cls) {
  for (const m of cls.members) {
    if (!ts.isPropertyDeclaration(m)) continue;
    const flags = ts.getCombinedModifierFlags(m);
    const isPublic = (flags & ts.ModifierFlags.Public) !== 0;
    const isReadonly = (flags & ts.ModifierFlags.Readonly) !== 0;
    if (!isPublic || !isReadonly) continue;
    if (!m.type || !ts.isTypeReferenceNode(m.type) || !ts.isIdentifier(m.type.typeName)) continue;
    const tn = m.type.typeName.text;
    if (tn.endsWith("UseCase") || tn.endsWith("Flow")) {
      return true;
    }
  }
  return false;
}

/**
 * @param {ts.SourceFile} sf
 * @returns {Set<string>}
 */
function collectAllImportedBindingNames(sf) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const clause = stmt.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const el of clause.namedBindings.elements) {
      names.add(el.name.text);
    }
  }
  return names;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function extractBindingsFromImportLine(line) {
  const trimmed = line.trim();
  const typeMatch = trimmed.match(/^import\s+type\s*\{([^}]*)\}\s*from\s*["'][^"']+["']\s*;?$/);
  const valMatch = trimmed.match(/^import\s+\{([^}]*)\}\s*from\s*["'][^"']+["']\s*;?$/);
  const raw = typeMatch ? typeMatch[1] : valMatch ? valMatch[1] : null;
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((s) =>
      s
        .trim()
        .replace(/^\s*type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim()
    )
    .filter(Boolean);
}

/**
 * @param {ts.SourceFile} sf
 * @returns {number}
 */
function lastImportEndIndex(sf) {
  let end = 0;
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      end = stmt.getEnd(sf);
    }
  }
  return end;
}

/**
 * @param {string} text
 * @param {string[]} lines
 */
function appendImportsIfMissing(text, lines) {
  if (!lines.length) {
    return text;
  }
  const sf = ts.createSourceFile(
    "_module.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const names = collectAllImportedBindingNames(sf);
  /** @type {string[]} */
  const toAdd = [];
  for (const line of lines) {
    const bindings = extractBindingsFromImportLine(line);
    if (!bindings.length) {
      continue;
    }
    if (bindings.some((b) => !names.has(b))) {
      toAdd.push(line);
      bindings.forEach((b) => names.add(b));
    }
  }
  if (!toAdd.length) {
    return text;
  }
  const end = lastImportEndIndex(sf);
  const prefix = end > 0 ? "\n" : "";
  let block = prefix + toAdd.join("\n");
  if (!block.endsWith("\n")) {
    block += "\n";
  }
  const afterImports = text.slice(end);
  let rest = afterImports.replace(/^\n+/, "");
  if (rest.length > 0) {
    rest = /^export\s/.test(rest) ? `\n\n${rest}` : `\n${rest}`;
  }
  return text.slice(0, end) + block + rest;
}

/**
 * @param {string} text
 * @param {ts.SourceFile} sf
 * @param {string} ifaceName
 * @param {{ name: string, typeText: string }[]} newProps
 */
function appendInfraProperties(text, sf, ifaceName, newProps) {
  if (!newProps.length) {
    return text;
  }
  const iface = findExportedInterfaceDeclaration(sf, ifaceName);
  if (!iface) {
    throw new Error(`Could not find export interface ${ifaceName} in module file.`);
  }
  const block = newProps.map((p) => `  ${p.name}: ${p.typeText};`).join("\n");
  if (iface.members.length === 0) {
    const openBrace = text.indexOf("{", iface.name.getEnd(sf));
    if (openBrace === -1) {
      throw new Error(`Could not find opening "{" for ${ifaceName}.`);
    }
    const closeBrace = indexOfMatchingBrace(text, openBrace);
    if (closeBrace === -1) {
      throw new Error(`Could not find closing "}" for ${ifaceName}.`);
    }
    return text.slice(0, openBrace + 1) + `\n${block}\n` + text.slice(closeBrace);
  }
  const last = iface.members[iface.members.length - 1];
  const pos = last.getEnd(sf);
  return text.slice(0, pos) + `\n${block}` + text.slice(pos);
}

/**
 * Append new slice getters immediately before the class closing `}` (after constructor and any existing members).
 * @param {string} text
 * @param {ts.SourceFile} sf
 * @param {string} modulePascal
 * @param {ReturnType<typeof extractWireSpec>[]} toWire
 */
function appendModuleGetterMethodsBeforeClassClose(text, sf, modulePascal, toWire) {
  const className = `${modulePascal}Module`;
  const cls = findExportedClassDeclaration(sf, className);
  if (!cls) {
    throw new Error(`Could not find export class ${className} in module file.`);
  }
  const getters = [...toWire]
    .sort((a, b) => a.fieldName.localeCompare(b.fieldName))
    .map((s) => emitSliceGetter(s))
    .join("\n\n");

  for (const child of cls.getChildren(sf)) {
    if (child.kind === ts.SyntaxKind.CloseBraceToken) {
      const closeStart = child.getStart(sf);
      return `${text.slice(0, closeStart)}\n${getters}\n${text.slice(closeStart)}`;
    }
  }
  throw new Error(`Could not find closing "}" for ${className}.`);
}

/**
 * Promote `constructor(infra: InfraName)` to `constructor(private readonly infra: InfraName)` when needed.
 * @param {string} text
 * @param {ts.SourceFile} sf
 * @param {string} modulePascal
 * @param {string} infraName
 */
function ensureConstructorPrivateReadonlyInfra(text, sf, modulePascal, infraName) {
  const className = `${modulePascal}Module`;
  const cls = findExportedClassDeclaration(sf, className);
  const ctor = cls?.members.find(ts.isConstructorDeclaration);
  if (!ctor?.parameters.length) {
    return text;
  }
  const p = ctor.parameters[0];
  if (p.name.getText(sf) !== "infra") {
    return text;
  }
  const hasPrivate = p.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ?? false;
  if (hasPrivate) {
    return text;
  }
  const typeStr = p.type ? p.type.getText(sf) : infraName;
  const start = p.getStart(sf);
  const end = p.getEnd(sf);
  return `${text.slice(0, start)}private readonly infra: ${typeStr}${text.slice(end)}`;
}

/**
 * Progressive wiring: add imports, Infra props, getter methods (before class `}`), promote constructor param.
 * @param {string} absPath
 * @param {ReturnType<typeof extractWireSpec>[]} newSpecs
 */
function wireAdditionalSlicesIntoModuleFile(absPath, newSpecs) {
  if (!newSpecs.length) {
    throw new Error("No use-cases or flows selected to wire.");
  }
  let text = fs.readFileSync(absPath, "utf8");
  const sf0 = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const moduleClass0 = findExportedModuleClass(sf0);
  if (!moduleClass0?.name) {
    throw new Error(`No exported *Module class found in ${absPath}`);
  }
  if (moduleUsesLegacyPublicSliceFields(moduleClass0)) {
    throw new Error(
      `Module ${absPath} still uses public readonly use-case/flow fields. Regenerate it with application-module (or migrate to camelCase slice methods) before using application-wire-module.`
    );
  }
  const modulePascal = moduleClass0.name.text.replace(/Module$/, "");
  const infraName = `${modulePascal}Infra`;

  const wired = getWiredSliceClassNamesFromModule(absPath);
  const toWire = newSpecs.filter((s) => !wired.has(s.className));
  if (!toWire.length) {
    throw new Error(
      "Selected slices are already wired in this module (same use-case/flow classes)."
    );
  }

  const existingInfraProps = getInterfacePropertySignatures(sf0, infraName);
  /** @type {Record<string, string>} */
  const existingInfra = Object.fromEntries(existingInfraProps.map((p) => [p.name, p.typeText]));
  const newInfraMerged = mergeInfraProperties(toWire);
  for (const { name, typeText } of newInfraMerged) {
    if (existingInfra[name] !== undefined && existingInfra[name] !== typeText) {
      throw new Error(
        `Infra property "${name}" already exists with type "${existingInfra[name]}"; cannot add conflicting "${typeText}".`
      );
    }
  }
  const newInfraOnly = newInfraMerged.filter((p) => existingInfra[p.name] === undefined);

  const bindingMap = mergeTypeBindingImportMaps(toWire.map((s) => s.absPath));
  const newTypeIds = [
    ...listInfraTypeIdentifiers(newInfraOnly),
    ...toWire.flatMap(typeIdentifiersNeededForSpec),
  ];
  const uniqueNewTypeIds = [...new Set(newTypeIds)].sort((a, b) => a.localeCompare(b));
  const typeImportLines =
    uniqueNewTypeIds.length === 0 ? [] : formatTypeImportLines(bindingMap, uniqueNewTypeIds);
  const classImportLines = [...toWire]
    .sort((a, b) => a.className.localeCompare(b.className))
    .map((s) => `import { ${s.className} } from "${s.relImport}";`);

  text = appendImportsIfMissing(text, [...typeImportLines, ...classImportLines]);

  let sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  text = appendInfraProperties(text, sf, infraName, newInfraOnly);

  sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  text = appendModuleGetterMethodsBeforeClassClose(text, sf, modulePascal, toWire);

  sf = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  text = ensureConstructorPrivateReadonlyInfra(text, sf, modulePascal, infraName);

  fs.writeFileSync(absPath, `${text.replace(/\n+$/, "")}\n`, "utf8");
}

module.exports = {
  extractWireSpec,
  mergeInfraProperties,
  buildWiredModuleSource,
  buildEmptyModuleSource,
  getWiredSliceClassNamesFromModule,
  wireAdditionalSlicesIntoModuleFile,
  appendImportsIfMissing,
};
