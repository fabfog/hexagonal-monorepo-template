"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Composition overview (`buildCompositionWiringGraph` default): apps → composition → application → modules.
 * Per-module drill-down: `buildApplicationModuleWiringGraph` → use-cases / flows → domain entities & services
 * → entity refs from each wired domain service file (path / import-string heuristics only, no metadata).
 */

/** @typedef {"app" | "composition" | "application" | "module" | "useCase" | "flow" | "port" | "domainEntity" | "domainService"} NodeKind */

/** @typedef {{ id: string, kind: NodeKind, label: string, pathFromRepo?: string }} WiringNode */

/** @typedef {{ from: string, to: string }} WiringEdge */

/**
 * Reduces false matches from examples in JSDoc / line comments (not a full TS lexer).
 * @param {string} source
 */
function stripTsCommentsApprox(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const KIND_COLORS = {
  app: "#c5cae9",
  composition: "#e1bee7",
  application: "#c8e6c9",
  module: "#fff9c4",
  useCase: "#b3e5fc",
  flow: "#ffccbc",
  port: "#d1c4e9",
  domainEntity: "#90caf9",
  domainService: "#64b5f6",
};

/**
 * Hierarchical rank for portable JSON snapshots (smaller = higher in overview layout).
 * @param {NodeKind} kind
 * @returns {number}
 */
function hierarchicalLevelForKind(kind) {
  switch (kind) {
    case "app":
      return 0;
    case "composition":
      return 1;
    case "application":
      return 2;
    case "module":
      return 3;
    case "useCase":
    case "flow":
      return 4;
    case "port":
      return 5;
    case "domainService":
      return 6;
    case "domainEntity":
      return 7;
    default:
      return 0;
  }
}

/**
 * Levels for {@link buildApplicationModuleWiringGraph} (module as root → slices → domain).
 * @param {NodeKind} kind
 * @returns {number}
 */
function hierarchicalLevelForModuleDetailRoot(kind) {
  switch (kind) {
    case "module":
      return 0;
    case "useCase":
    case "flow":
      return 1;
    case "port":
      return 2;
    case "domainService":
      return 3;
    case "domainEntity":
      return 4;
    default:
      return 0;
  }
}

/**
 * @param {string} dir
 * @param {string[]} [extensions]
 * @returns {string[]}
 */
function walkTsFiles(dir, extensions = [".ts"]) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
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
      if (!e.isFile()) continue;
      if (!extensions.some((ext) => e.name.endsWith(ext))) continue;
      if (
        e.name.endsWith(".test.ts") ||
        e.name.endsWith(".spec.ts") ||
        e.name.endsWith(".test.tsx") ||
        e.name.endsWith(".spec.tsx")
      ) {
        continue;
      }
      out.push(full);
    }
  }
  return out;
}

/**
 * First path segment after @application/ is the workspace package folder name.
 * @param {string} source
 * @returns {string[]}
 */
function extractApplicationPackageNames(source) {
  const names = new Set();
  const cleaned = stripTsCommentsApprox(source);
  const re = /@application\/([^/"'\s]+)/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const first = m[1].split("/")[0];
    if (first) names.add(first);
  }
  return [...names];
}

/**
 * First path segment after @composition/ (package folder under packages/composition).
 * @param {string} source
 * @returns {string[]}
 */
function extractCompositionPackageNames(source) {
  const names = new Set();
  const cleaned = stripTsCommentsApprox(source);
  const re = /@composition\/([^/"'\s]+)/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const first = m[1].split("/")[0];
    if (first) names.add(first);
  }
  return [...names];
}

/**
 * @param {string} name
 */
function pascalToKebab(name) {
  const s = String(name).trim();
  if (!s) return "";
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * @param {string} inner brace content of import { ... }
 * @returns {string[]}
 */
function parseNamedImportIdentifiers(inner) {
  const ids = [];
  const stripped = inner.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*/g, " ");
  for (const part of stripped.split(",")) {
    let p = part.trim();
    if (!p) continue;
    p = p.replace(/^type\s+/, "").trim();
    const asIdx = p.lastIndexOf(" as ");
    if (asIdx !== -1) p = p.slice(0, asIdx).trim();
    if (!p || p === "type") continue;
    if (!/^[A-Za-z_][\w]*$/.test(p)) continue;
    ids.push(p);
  }
  return ids;
}

/**
 * @param {string} repoRoot
 * @param {string} domainPkg
 * @param {string} className
 * @returns {string | null} kebab file stem (no .entity.ts)
 */
function resolveEntityKebab(repoRoot, domainPkg, className) {
  const baseDir = path.join(repoRoot, "packages", "domain", domainPkg, "src", "entities");
  const candidates = [
    `${pascalToKebab(className)}.entity.ts`,
    `${pascalToKebab(className.replace(/Entity$/, ""))}.entity.ts`,
  ];
  for (const c of candidates) {
    const abs = path.join(baseDir, c);
    if (fs.existsSync(abs)) return c.replace(/\.entity\.ts$/, "");
  }
  return null;
}

/**
 * @param {string} repoRoot
 * @param {string} domainPkg
 * @param {string} className
 * @returns {string | null} kebab file stem (no .service.ts)
 */
function resolveServiceKebab(repoRoot, domainPkg, className) {
  const baseDir = path.join(repoRoot, "packages", "domain", domainPkg, "src", "services");
  const stem = className.endsWith("Service") ? className.slice(0, -7) : className;
  const candidates = [
    `${pascalToKebab(stem)}.service.ts`,
    `${pascalToKebab(className)}.service.ts`,
  ];
  for (const c of candidates) {
    const abs = path.join(baseDir, c);
    if (fs.existsSync(abs)) return c.replace(/\.service\.ts$/, "");
  }
  return null;
}

/**
 * First `export class Name` in an entity or domain service module.
 * @param {string} absPath
 * @returns {string | null}
 */
function readExportedDomainClassName(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const text = fs.readFileSync(absPath, "utf8");
  const m = text.match(/export\s+class\s+([A-Za-z_][\w]*)/);
  return m ? m[1] : null;
}

/**
 * @param {string} kebabStem file stem (e.g. order-line)
 */
function kebabStemToPascal(kebabStem) {
  return kebabStem
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}

/**
 * @param {string} source
 * @param {string} repoRoot
 * @param {(kind: "domainEntity" | "domainService", domainPkg: string, className: string, label: string) => void} onRef
 */
function extractDomainEntityAndServiceRefs(source, repoRoot, onRef) {
  const cleaned = stripTsCommentsApprox(source);
  // Use [^}]* not [\s\S]*? so the closing `}` cannot pair with a different statement's `}`.
  // Otherwise `import type { ...` on line 1 can wrongly match the `}` of a later `import { X } from "@domain/..."`.
  const barrelRe =
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@domain\/([^/"']+)\/(entities|services)["']\s*;/g;
  let m;
  while ((m = barrelRe.exec(cleaned)) !== null) {
    const inner = m[1];
    const domainPkg = m[2];
    const slice = m[3];
    const pkgPath = path.join(repoRoot, "packages", "domain", domainPkg, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    for (const id of parseNamedImportIdentifiers(inner)) {
      if (slice === "entities") {
        const kebab = resolveEntityKebab(repoRoot, domainPkg, id);
        if (kebab) onRef("domainEntity", domainPkg, id, `@domain/${domainPkg}/entities\n${id}`);
      } else {
        const kebab = resolveServiceKebab(repoRoot, domainPkg, id);
        if (kebab) onRef("domainService", domainPkg, id, `@domain/${domainPkg}/services\n${id}`);
      }
    }
  }

  const entitySubRe =
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@domain\/([^/"']+)\/entities\/([a-z0-9-]+)(?:\.entity)?["']\s*;/g;
  while ((m = entitySubRe.exec(cleaned)) !== null) {
    const domainPkg = m[2];
    const stem = m[3];
    const pkgPath = path.join(repoRoot, "packages", "domain", domainPkg, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const abs = path.join(
      repoRoot,
      "packages",
      "domain",
      domainPkg,
      "src",
      "entities",
      `${stem}.entity.ts`
    );
    if (fs.existsSync(abs)) {
      const ids = parseNamedImportIdentifiers(m[1]);
      const className =
        ids[0] || readExportedDomainClassName(abs) || `${kebabStemToPascal(stem)}Entity`;
      onRef("domainEntity", domainPkg, className, `@domain/${domainPkg}/entities → ${className}`);
    }
  }

  const entitySubDefaultRe =
    /import\s+(?:type\s+)?(\w+)\s+from\s+["']@domain\/([^/"']+)\/entities\/([a-z0-9-]+)(?:\.entity)?["']\s*;/g;
  while ((m = entitySubDefaultRe.exec(cleaned)) !== null) {
    const domainPkg = m[2];
    const stem = m[3];
    const pkgPath = path.join(repoRoot, "packages", "domain", domainPkg, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const abs = path.join(
      repoRoot,
      "packages",
      "domain",
      domainPkg,
      "src",
      "entities",
      `${stem}.entity.ts`
    );
    if (fs.existsSync(abs)) {
      const localName = m[1];
      const className = readExportedDomainClassName(abs) || localName;
      onRef("domainEntity", domainPkg, className, `@domain/${domainPkg}/entities → ${className}`);
    }
  }

  const serviceSubRe =
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@domain\/([^/"']+)\/services\/([a-z0-9-]+)(?:\.service)?["']\s*;/g;
  while ((m = serviceSubRe.exec(cleaned)) !== null) {
    const domainPkg = m[2];
    const stem = m[3];
    const pkgPath = path.join(repoRoot, "packages", "domain", domainPkg, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const abs = path.join(
      repoRoot,
      "packages",
      "domain",
      domainPkg,
      "src",
      "services",
      `${stem}.service.ts`
    );
    if (fs.existsSync(abs)) {
      const ids = parseNamedImportIdentifiers(m[1]);
      const className =
        ids[0] || readExportedDomainClassName(abs) || `${kebabStemToPascal(stem)}Service`;
      onRef("domainService", domainPkg, className, `@domain/${domainPkg}/services → ${className}`);
    }
  }

  const serviceSubDefaultRe =
    /import\s+(?:type\s+)?(\w+)\s+from\s+["']@domain\/([^/"']+)\/services\/([a-z0-9-]+)(?:\.service)?["']\s*;/g;
  while ((m = serviceSubDefaultRe.exec(cleaned)) !== null) {
    const domainPkg = m[2];
    const stem = m[3];
    const pkgPath = path.join(repoRoot, "packages", "domain", domainPkg, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    const abs = path.join(
      repoRoot,
      "packages",
      "domain",
      domainPkg,
      "src",
      "services",
      `${stem}.service.ts`
    );
    if (fs.existsSync(abs)) {
      const localName = m[1];
      const className = readExportedDomainClassName(abs) || localName;
      onRef("domainService", domainPkg, className, `@domain/${domainPkg}/services → ${className}`);
    }
  }
}

/**
 * @param {string} source
 * @param {string} appPkg
 * @param {(portName: string, label: string) => void} onPortRef
 */
function extractApplicationPortRefs(source, appPkg, onPortRef) {
  const cleaned = stripTsCommentsApprox(source);
  const patterns = [
    new RegExp(
      String.raw`import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@application\/${appPkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\/ports["']\s*;`,
      "g"
    ),
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']\.\.\/ports\/([a-z0-9-]+)(?:\.[a-z0-9-]+\.port)?["']\s*;/g,
    /import\s+(?:type\s+)?(\w+)\s+from\s+["']\.\.\/ports\/([a-z0-9-]+)(?:\.[a-z0-9-]+\.port)?["']\s*;/g,
  ];

  let m;
  while ((m = patterns[0].exec(cleaned)) !== null) {
    for (const id of parseNamedImportIdentifiers(m[1])) {
      onPortRef(id, `@application/${appPkg}/ports\n${id}`);
    }
  }
  while ((m = patterns[1].exec(cleaned)) !== null) {
    for (const id of parseNamedImportIdentifiers(m[1])) {
      onPortRef(id, `../ports → ${id}`);
    }
  }
  while ((m = patterns[2].exec(cleaned)) !== null) {
    onPortRef(m[1], `../ports → ${m[1]}`);
  }
}

/**
 * Entity imports relative to `packages/domain/<domainPkg>/src/services/*.service.ts` (e.g. `../entities`).
 * @param {string} source
 * @param {string} repoRoot
 * @param {string} domainPkg
 * @param {(domainPkg: string, className: string, label: string) => void} onEntityRef
 */
function extractRelativeDomainEntityRefs(source, repoRoot, domainPkg, onEntityRef) {
  const cleaned = stripTsCommentsApprox(source);
  const pkgPath = path.join(repoRoot, "packages", "domain", domainPkg, "package.json");
  if (!fs.existsSync(pkgPath)) return;

  const relBarrelRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']\.\.\/entities["']\s*;/g;
  let m;
  while ((m = relBarrelRe.exec(cleaned)) !== null) {
    for (const id of parseNamedImportIdentifiers(m[1])) {
      const kebab = resolveEntityKebab(repoRoot, domainPkg, id);
      if (kebab) onEntityRef(domainPkg, id, `@domain/${domainPkg}/entities\n${id}`);
    }
  }

  const relSubRe =
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']\.\.\/entities\/([a-z0-9-]+)(?:\.entity)?["']\s*;/g;
  while ((m = relSubRe.exec(cleaned)) !== null) {
    const stem = m[2];
    const abs = path.join(
      repoRoot,
      "packages",
      "domain",
      domainPkg,
      "src",
      "entities",
      `${stem}.entity.ts`
    );
    if (fs.existsSync(abs)) {
      const ids = parseNamedImportIdentifiers(m[1]);
      const className =
        ids[0] || readExportedDomainClassName(abs) || `${kebabStemToPascal(stem)}Entity`;
      onEntityRef(domainPkg, className, `@domain/${domainPkg}/entities → ${className}`);
    }
  }

  const relDefaultRe =
    /import\s+(?:type\s+)?(\w+)\s+from\s+["']\.\.\/entities\/([a-z0-9-]+)(?:\.entity)?["']\s*;/g;
  while ((m = relDefaultRe.exec(cleaned)) !== null) {
    const stem = m[2];
    const abs = path.join(
      repoRoot,
      "packages",
      "domain",
      domainPkg,
      "src",
      "entities",
      `${stem}.entity.ts`
    );
    if (fs.existsSync(abs)) {
      const localName = m[1];
      const className = readExportedDomainClassName(abs) || localName;
      onEntityRef(domainPkg, className, `@domain/${domainPkg}/entities → ${className}`);
    }
  }
}

/**
 * @param {string} repoRoot
 * @param {string} domainPkg
 * @param {string} className
 * @returns {string | null} absolute path to .service.ts
 */
function resolveDomainServiceAbsPath(repoRoot, domainPkg, className) {
  const kebab = resolveServiceKebab(repoRoot, domainPkg, className);
  if (!kebab) return null;
  const abs = path.join(
    repoRoot,
    "packages",
    "domain",
    domainPkg,
    "src",
    "services",
    `${kebab}.service.ts`
  );
  return fs.existsSync(abs) ? abs : null;
}

/**
 * Edges domainService → domainEntity from a wired service’s imports (@domain/… and ../entities).
 * @param {string} repoRoot
 * @param {string} serviceNodeId
 * @param {string} domainPkg
 * @param {string} className
 * @param {(id: string, kind: NodeKind, label: string) => void} addNode
 * @param {WiringEdge[]} edges
 */
function wireDomainServiceToDomainEntities(
  repoRoot,
  serviceNodeId,
  domainPkg,
  className,
  addNode,
  edges
) {
  const absPath = resolveDomainServiceAbsPath(repoRoot, domainPkg, className);
  if (!absPath) return;
  const text = fs.readFileSync(absPath, "utf8");

  function pushEntity(dpkg, cname, label) {
    const nid = `de_${mermaidSafeId(dpkg)}_${mermaidSafeId(cname)}`;
    addNode(nid, "domainEntity", label);
    edges.push({ from: serviceNodeId, to: nid });
  }

  extractDomainEntityAndServiceRefs(text, repoRoot, (kind, dpkg, cname, label) => {
    if (kind === "domainEntity") pushEntity(dpkg, cname, label);
  });
  extractRelativeDomainEntityRefs(text, repoRoot, domainPkg, pushEntity);
}

/**
 * @param {string} moduleFileContent
 * @returns {{ useCases: string[], flows: string[] }}
 */
function extractWiredSlicesFromModuleSource(moduleFileContent) {
  const useCases = new Set();
  const flows = new Set();
  const cleaned = stripTsCommentsApprox(moduleFileContent);

  const ucPatterns = [
    /\.\.\/use-cases\/([a-z0-9-]+)\.use-case/g,
    /@application\/[^/"']+\/use-cases\/([a-z0-9-]+)\.use-case/g,
  ];
  const flowPatterns = [
    /\.\.\/flows\/([a-z0-9-]+)\.flow/g,
    /@application\/[^/"']+\/flows\/([a-z0-9-]+)\.flow/g,
  ];

  for (const re of ucPatterns) {
    let m;
    while ((m = re.exec(cleaned)) !== null) useCases.add(m[1]);
  }
  for (const re of flowPatterns) {
    let m;
    while ((m = re.exec(cleaned)) !== null) flows.add(m[1]);
  }

  return {
    useCases: [...useCases].sort(),
    flows: [...flows].sort(),
  };
}

/**
 * @param {string} s
 */
function mermaidSafeId(s) {
  return s.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * @param {string} repoRoot
 * @returns {{ nodes: Map<string, WiringNode>, edges: WiringEdge[] }}
 */
/**
 * @param {string} repoRoot
 * @param {string} absPath
 * @param {string} consumerId
 * @param {(id: string, kind: NodeKind, label: string) => void} addNode
 * @param {WiringEdge[]} edges
 * @param {string} appPkg
 * @param {Map<string, { domainPkg: string, className: string }> | null} [domainServiceRegistry]
 */
function wireConsumerToDomain(
  repoRoot,
  absPath,
  consumerId,
  addNode,
  edges,
  appPkg,
  domainServiceRegistry
) {
  if (!fs.existsSync(absPath)) return;
  const text = fs.readFileSync(absPath, "utf8");
  extractApplicationPortRefs(text, appPkg, (portName, label) => {
    const nid = `p_${mermaidSafeId(appPkg)}_${mermaidSafeId(portName)}`;
    addNode(nid, "port", label);
    edges.push({ from: consumerId, to: nid });
  });
  extractDomainEntityAndServiceRefs(text, repoRoot, (kind, domainPkg, className, label) => {
    const prefix = kind === "domainEntity" ? "de" : "ds";
    const nid = `${prefix}_${mermaidSafeId(domainPkg)}_${mermaidSafeId(className)}`;
    addNode(nid, kind, label);
    edges.push({ from: consumerId, to: nid });
    if (kind === "domainService" && domainServiceRegistry) {
      domainServiceRegistry.set(nid, { domainPkg, className });
    }
  });
}

/**
 * @param {string} repoRoot
 * @param {Map<string, WiringNode>} nodes
 * @param {WiringEdge[]} edges
 * @param {(id: string, kind: NodeKind, label: string) => void} addNode
 * @param {Set<string>} compositionFolderNames
 */
function appendAppToCompositionEdges(repoRoot, nodes, edges, addNode, compositionFolderNames) {
  const appsRoot = path.join(repoRoot, "apps");
  if (!fs.existsSync(appsRoot)) return;

  const appDirs = fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(appsRoot, name, "package.json")))
    .sort();

  for (const appName of appDirs) {
    const srcDir = path.join(appsRoot, appName, "src");
    /** @type {Set<string>} */
    const compRefs = new Set();
    for (const file of walkTsFiles(srcDir, [".ts", ".tsx"])) {
      const text = fs.readFileSync(file, "utf8");
      for (const c of extractCompositionPackageNames(text)) {
        if (compositionFolderNames.has(c)) compRefs.add(c);
      }
    }
    if (compRefs.size === 0) continue;

    const appId = `app_${mermaidSafeId(appName)}`;
    addNode(appId, "app", `apps/${appName}`);
    for (const c of [...compRefs].sort()) {
      const cid = `c_${mermaidSafeId(c)}`;
      if (nodes.has(cid)) edges.push({ from: appId, to: cid });
    }
  }
}

/**
 * @param {string} repoRoot
 * @param {{ expandModules?: boolean }} [options] If `expandModules` is true, include use-cases, flows, and domain (full graph). Default **false**: stop at application modules for a readable overview. The CLI enables this with `pnpm deps:graph:composition -- --full`.
 */
function buildCompositionWiringGraph(repoRoot, options = {}) {
  const expandModules = options.expandModules === true;

  /** @type {Map<string, WiringNode>} */
  const nodes = new Map();
  /** @type {WiringEdge[]} */
  const edges = [];

  /**
   * @param {string} id
   * @param {NodeKind} kind
   * @param {string} label
   * @param {string} [pathFromRepo] posix path from repo root (e.g. module `*.module.ts` for vis click → deps:graph:module)
   */
  function addNode(id, kind, label, pathFromRepo) {
    if (nodes.has(id)) return;
    /** @type {WiringNode} */
    const n = { id, kind, label };
    if (pathFromRepo) n.pathFromRepo = pathFromRepo;
    nodes.set(id, n);
  }

  const compositionRoot = path.join(repoRoot, "packages", "composition");
  if (!fs.existsSync(compositionRoot)) {
    return { nodes, edges };
  }

  const compDirs = fs
    .readdirSync(compositionRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(compositionRoot, name, "package.json")))
    .sort();

  const compositionFolderNames = new Set(compDirs);

  /** Application node ids (`a_*`) for which module edges (and optional expand) already ran — avoids duplicate arcs when several `@composition/*` packages import the same app. */
  const applicationModulesWired = new Set();

  /** @type {Map<string, { domainPkg: string, className: string }>} */
  const domainServiceRegistry = new Map();

  for (const compName of compDirs) {
    const cid = `c_${mermaidSafeId(compName)}`;
    addNode(cid, "composition", `@composition/${compName}`);

    const srcDir = path.join(compositionRoot, compName, "src");
    const appNames = new Set();
    for (const file of walkTsFiles(srcDir, [".ts", ".tsx"])) {
      const text = fs.readFileSync(file, "utf8");
      for (const pkg of extractApplicationPackageNames(text)) {
        const appPath = path.join(repoRoot, "packages", "application", pkg, "package.json");
        if (fs.existsSync(appPath)) appNames.add(pkg);
      }
    }

    for (const appName of [...appNames].sort()) {
      const aid = `a_${mermaidSafeId(appName)}`;
      addNode(aid, "application", `@application/${appName}`);
      edges.push({ from: cid, to: aid });

      if (applicationModulesWired.has(aid)) continue;
      applicationModulesWired.add(aid);

      const modulesDir = path.join(repoRoot, "packages", "application", appName, "src", "modules");
      if (!fs.existsSync(modulesDir)) continue;

      const moduleFiles = fs
        .readdirSync(modulesDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".module.ts") && !e.name.endsWith(".test.ts"))
        .map((e) => e.name)
        .sort();

      for (const mf of moduleFiles) {
        const base = mf.replace(/\.module\.ts$/, "");
        const mid = `m_${mermaidSafeId(appName)}_${mermaidSafeId(base)}`;
        const pathFromRepo = ["packages", "application", appName, "src", "modules", mf].join("/");
        addNode(mid, "module", `${appName}/${base}.module`, pathFromRepo);
        edges.push({ from: aid, to: mid });

        if (!expandModules) continue;

        const absMod = path.join(modulesDir, mf);
        const content = fs.readFileSync(absMod, "utf8");
        const { useCases, flows } = extractWiredSlicesFromModuleSource(content);

        for (const uc of useCases) {
          const ucPath = path.join(
            repoRoot,
            "packages",
            "application",
            appName,
            "src",
            "use-cases",
            `${uc}.use-case.ts`
          );
          if (!fs.existsSync(ucPath)) continue;
          const uid = `uc_${mermaidSafeId(appName)}_${mermaidSafeId(uc)}`;
          addNode(uid, "useCase", `${uc}.use-case`);
          edges.push({ from: mid, to: uid });
          wireConsumerToDomain(
            repoRoot,
            ucPath,
            uid,
            addNode,
            edges,
            appName,
            domainServiceRegistry
          );
        }
        for (const fl of flows) {
          const flPath = path.join(
            repoRoot,
            "packages",
            "application",
            appName,
            "src",
            "flows",
            `${fl}.flow.ts`
          );
          if (!fs.existsSync(flPath)) continue;
          const fid = `fl_${mermaidSafeId(appName)}_${mermaidSafeId(fl)}`;
          addNode(fid, "flow", `${fl}.flow`);
          edges.push({ from: mid, to: fid });
          wireConsumerToDomain(
            repoRoot,
            flPath,
            fid,
            addNode,
            edges,
            appName,
            domainServiceRegistry
          );
        }
      }
    }
  }

  if (expandModules) {
    for (const [serviceId, { domainPkg, className }] of domainServiceRegistry) {
      wireDomainServiceToDomainEntities(repoRoot, serviceId, domainPkg, className, addNode, edges);
    }
  }

  appendAppToCompositionEdges(repoRoot, nodes, edges, addNode, compositionFolderNames);

  return { nodes, edges };
}

/**
 * Resolve a CLI argument to an application `*.module.ts` under the repo.
 * Accepts a repo-relative or absolute path, or the same label as the composition graph:
 * `<application-folder>/<kebab>.module` or `<application-folder>/<kebab>.module.ts`.
 * @param {string} repoRoot
 * @param {string} userArg
 * @returns {string | null} absolute normalized path
 */
function resolveApplicationModuleFileArg(repoRoot, userArg) {
  if (userArg == null || !String(userArg).trim()) return null;
  const raw = String(userArg).trim().replace(/\\/g, "/");
  if (!raw.includes("..")) {
    const short = raw.match(/^([^/]+)\/([a-z0-9-]+)\.module(?:\.ts)?$/);
    if (short) {
      const appFolder = short[1];
      const kebab = short[2];
      const candidate = path.normalize(
        path.join(
          repoRoot,
          "packages",
          "application",
          appFolder,
          "src",
          "modules",
          `${kebab}.module.ts`
        )
      );
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const rel = path.relative(repoRoot, candidate).replace(/\\/g, "/");
        if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
          if (rel.match(/^packages\/application\/[^/]+\/src\/modules\/[a-z0-9-]+\.module\.ts$/)) {
            return candidate;
          }
        }
      }
    }
  }

  const abs = path.isAbsolute(raw) ? path.normalize(raw) : path.normalize(path.join(repoRoot, raw));
  if (!abs.endsWith(".module.ts")) return null;
  const rel = path.relative(repoRoot, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  if (
    !rel
      .replace(/\\/g, "/")
      .match(/^packages\/application\/[^/]+\/src\/modules\/[a-z0-9-]+\.module\.ts$/)
  ) {
    return null;
  }
  return abs;
}

/**
 * Drill-down graph for one `*.module.ts`: module → wired use-cases & flows → domain (same heuristics as full composition graph).
 * @param {string} repoRoot
 * @param {string} moduleAbsPath absolute path to `packages/application/<pkg>/src/modules/<kebab>.module.ts`
 * @returns {{ nodes: Map<string, WiringNode>, edges: WiringEdge[] }}
 */
function buildApplicationModuleWiringGraph(repoRoot, moduleAbsPath) {
  /** @type {Map<string, WiringNode>} */
  const nodes = new Map();
  /** @type {WiringEdge[]} */
  const edges = [];

  /**
   * @param {string} id
   * @param {NodeKind} kind
   * @param {string} label
   * @param {string} [pathFromRepo]
   */
  function addNode(id, kind, label, pathFromRepo) {
    if (nodes.has(id)) return;
    /** @type {WiringNode} */
    const n = { id, kind, label };
    if (pathFromRepo) n.pathFromRepo = pathFromRepo;
    nodes.set(id, n);
  }

  const rel = path.relative(repoRoot, moduleAbsPath).replace(/\\/g, "/");
  const m = rel.match(/^packages\/application\/([^/]+)\/src\/modules\/([a-z0-9-]+)\.module\.ts$/);
  if (!m) {
    throw new Error(
      `Expected packages/application/<app>/src/modules/<kebab>.module.ts, got: ${rel}`
    );
  }
  const appName = m[1];
  const base = m[2];
  const mid = `m_${mermaidSafeId(appName)}_${mermaidSafeId(base)}`;
  addNode(mid, "module", `${appName}/${base}.module`, rel);

  const content = fs.readFileSync(moduleAbsPath, "utf8");
  const { useCases, flows } = extractWiredSlicesFromModuleSource(content);

  /** @type {Map<string, { domainPkg: string, className: string }>} */
  const domainServiceRegistry = new Map();

  for (const uc of useCases) {
    const ucPath = path.join(
      repoRoot,
      "packages",
      "application",
      appName,
      "src",
      "use-cases",
      `${uc}.use-case.ts`
    );
    if (!fs.existsSync(ucPath)) continue;
    const uid = `uc_${mermaidSafeId(appName)}_${mermaidSafeId(uc)}`;
    addNode(uid, "useCase", `${uc}.use-case`);
    edges.push({ from: mid, to: uid });
    wireConsumerToDomain(repoRoot, ucPath, uid, addNode, edges, appName, domainServiceRegistry);
  }
  for (const fl of flows) {
    const flPath = path.join(
      repoRoot,
      "packages",
      "application",
      appName,
      "src",
      "flows",
      `${fl}.flow.ts`
    );
    if (!fs.existsSync(flPath)) continue;
    const fid = `fl_${mermaidSafeId(appName)}_${mermaidSafeId(fl)}`;
    addNode(fid, "flow", `${fl}.flow`);
    edges.push({ from: mid, to: fid });
    wireConsumerToDomain(repoRoot, flPath, fid, addNode, edges, appName, domainServiceRegistry);
  }

  for (const [serviceId, { domainPkg, className }] of domainServiceRegistry) {
    wireDomainServiceToDomainEntities(repoRoot, serviceId, domainPkg, className, addNode, edges);
  }

  return { nodes, edges };
}

/**
 * Flat flowchart (no subgraphs): shared application packages may link from multiple composition roots.
 * @param {Map<string, WiringNode>} nodes
 * @param {WiringEdge[]} edges
 * @returns {string}
 */
function toWiringMermaid(nodes, edges) {
  const lines = ["flowchart TB"];

  for (const kind of Object.keys(KIND_COLORS)) {
    lines.push(`  classDef kind_${kind} fill:${KIND_COLORS[kind]},stroke:#37474f,color:#111;`);
  }

  for (const n of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const mid = mermaidSafeId(n.id);
    const label = n.label.replace(/"/g, "#quot;");
    lines.push(`  ${mid}["${label}"]:::kind_${n.kind}`);
  }

  for (const e of edges) {
    lines.push(`  ${mermaidSafeId(e.from)} --> ${mermaidSafeId(e.to)}`);
  }

  return lines.join("\n");
}

/**
 * Portable graph snapshot (e.g. for tooling or future viewers).
 * @param {Map<string, WiringNode>} nodes
 * @param {WiringEdge[]} edges
 * @param {(kind: NodeKind) => number} [levelForKind] defaults to {@link hierarchicalLevelForKind}
 * @returns {{ nodes: Array<{ id: string, label: string, kind: NodeKind, level: number, pathFromRepo?: string }>, edges: Array<{ from: string, to: string }> }}
 */
function toWiringGraphJson(nodes, edges, levelForKind = hierarchicalLevelForKind) {
  const nodeList = [...nodes.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => {
      /** @type {{ id: string, label: string, kind: NodeKind, level: number, pathFromRepo?: string }} */
      const o = {
        id: n.id,
        label: n.label,
        kind: n.kind,
        level: levelForKind(n.kind),
      };
      if (n.pathFromRepo) o.pathFromRepo = n.pathFromRepo;
      return o;
    });
  const edgeList = edges.map((e) => ({ from: e.from, to: e.to }));
  return { nodes: nodeList, edges: edgeList };
}

const DEFAULT_COMPOSITION_MERMAID_HINT = `Derived from file paths and import strings only (no extra metadata). <strong>Overview</strong> stops at <code>*.module.ts</code> unless you re-run with <code>pnpm deps:graph:composition -- --full</code> (use-cases, flows, ports, domain). For drill-down run <code>pnpm deps:graph:module -- …</code> with the repo path to the file or the same label as a module node (<code>&lt;app-folder&gt;/&lt;kebab&gt;.module</code>). <strong>Apps</strong>: <code>apps/&lt;name&gt;/src/**/*.{ts,tsx}</code> referencing <code>@composition/&lt;pkg&gt;</code>. <strong>Composition → application</strong>: scan composition <code>src</code> for <code>@application/&lt;pkg&gt;/…</code>. <strong>Application → modules</strong>: one node per <code>src/modules/*.module.ts</code>.`;

/**
 * @param {string} s
 */
function escapeHtmlText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * @param {string} mermaidSource
 * @param {{ title?: string, heading?: string, hint?: string }} [meta]
 * @returns {string}
 */
function wiringMermaidToHtml(mermaidSource, meta = {}) {
  const safe = mermaidSource.replace(/&/g, "&amp;");
  const title = meta.title ?? "Composition wiring graph";
  const heading = meta.heading ?? "Composition wiring (apps → composition → application → modules)";
  const hint = meta.hint ?? DEFAULT_COMPOSITION_MERMAID_HINT;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlText(title)}</title>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, securityLevel: "loose", theme: "neutral" });
  </script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; background: #fafafa; }
    h1 { font-size: 1.1rem; color: #263238; }
    .hint { color: #546e7a; font-size: 0.85rem; margin-bottom: 1rem; max-width: 52rem; line-height: 1.4; }
    .mermaid { background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 4px #0001; }
  </style>
</head>
<body>
  <h1>${escapeHtmlText(heading)}</h1>
  <p class="hint">${hint}</p>
  <pre class="mermaid">${safe}</pre>
</body>
</html>`;
}

module.exports = {
  buildCompositionWiringGraph,
  buildApplicationModuleWiringGraph,
  resolveApplicationModuleFileArg,
  toWiringMermaid,
  toWiringGraphJson,
  wiringMermaidToHtml,
  hierarchicalLevelForKind,
  hierarchicalLevelForModuleDetailRoot,
  KIND_COLORS,
  walkTsFiles,
  extractApplicationPackageNames,
  extractCompositionPackageNames,
  extractWiredSlicesFromModuleSource,
  extractDomainEntityAndServiceRefs,
  readExportedDomainClassName,
  pascalToKebab,
  resolveEntityKebab,
  resolveServiceKebab,
  resolveDomainServiceAbsPath,
  wireDomainServiceToDomainEntities,
  extractRelativeDomainEntityRefs,
};
