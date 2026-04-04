"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Graph: apps → composition → application → modules → use-cases / flows → domain entities & services
 * → entity refs from each wired domain service file (path / import-string heuristics only, no metadata).
 */

/** @typedef {"app" | "composition" | "application" | "module" | "useCase" | "flow" | "domainEntity" | "domainService"} NodeKind */

/** @typedef {{ id: string, kind: NodeKind, label: string }} WiringNode */

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
  domainEntity: "#90caf9",
  domainService: "#64b5f6",
};

/**
 * vis-network hierarchical levels: app → composition → application → module → use-case/flow → domain (service then entity).
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
    case "domainService":
      return 5;
    case "domainEntity":
      return 6;
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
 * @param {Map<string, { domainPkg: string, className: string }> | null} [domainServiceRegistry]
 */
function wireConsumerToDomain(
  repoRoot,
  absPath,
  consumerId,
  addNode,
  edges,
  domainServiceRegistry
) {
  if (!fs.existsSync(absPath)) return;
  const text = fs.readFileSync(absPath, "utf8");
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

function buildCompositionWiringGraph(repoRoot) {
  /** @type {Map<string, WiringNode>} */
  const nodes = new Map();
  /** @type {WiringEdge[]} */
  const edges = [];

  function addNode(id, kind, label) {
    if (!nodes.has(id)) nodes.set(id, { id, kind, label });
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
        addNode(mid, "module", `${appName}/${base}.module`);
        edges.push({ from: aid, to: mid });

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
          wireConsumerToDomain(repoRoot, ucPath, uid, addNode, edges, domainServiceRegistry);
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
          wireConsumerToDomain(repoRoot, flPath, fid, addNode, edges, domainServiceRegistry);
        }
      }
    }
  }

  for (const [serviceId, { domainPkg, className }] of domainServiceRegistry) {
    wireDomainServiceToDomainEntities(repoRoot, serviceId, domainPkg, className, addNode, edges);
  }

  appendAppToCompositionEdges(repoRoot, nodes, edges, addNode, compositionFolderNames);

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
 * Portable graph snapshot (e.g. for vis-network, Cytoscape, or other tools).
 * @param {Map<string, WiringNode>} nodes
 * @param {WiringEdge[]} edges
 * @returns {{ nodes: Array<{ id: string, label: string, kind: NodeKind, level: number }>, edges: Array<{ from: string, to: string }> }}
 */
function toWiringGraphJson(nodes, edges) {
  const nodeList = [...nodes.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind,
      level: hierarchicalLevelForKind(n.kind),
    }));
  const edgeList = edges.map((e) => ({ from: e.from, to: e.to }));
  return { nodes: nodeList, edges: edgeList };
}

/**
 * Self-contained HTML: vis-network + embedded JSON (works from file://).
 * @param {{ nodes: Array<{ id: string, label: string, kind: NodeKind, level?: number }>, edges: Array<{ from: string, to: string }> }} payload
 * @returns {string}
 */
function wiringInteractiveVisHtml(payload) {
  const kindColorsJson = JSON.stringify(KIND_COLORS).replace(/</g, "\\u003c");
  const dataJson = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Composition wiring (interactive)</title>
  <script src="https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; background: #f5f5f5; color: #263238; }
    header { padding: 0.75rem 1rem; background: #fff; border-bottom: 1px solid #e0e0e0; }
    h1 { font-size: 1rem; margin: 0 0 0.35rem; }
    .hint { font-size: 0.8rem; color: #546e7a; max-width: 48rem; line-height: 1.4; margin: 0; }
    #graph { width: 100%; height: calc(100vh - 5.5rem); background: #fafafa; }
    .toolbar { padding: 0.35rem 1rem; background: #eee; font-size: 0.8rem; color: #455a64; }
    .toolbar button {
      margin-right: 0.5rem;
      padding: 0.25rem 0.6rem;
      font-size: 0.8rem;
      cursor: pointer;
      border: 1px solid #b0bec5;
      border-radius: 4px;
      background: #fff;
    }
    .toolbar button:hover { background: #eceff1; }
  </style>
</head>
<body>
  <header>
    <h1>Composition wiring — interactive (vis-network)</h1>
    <p class="hint">Hierarchical layout: app → composition → application → module → use-case/flow → domain (service, then entity). Toggle top–bottom vs left–right. Drag the canvas to pan, scroll to zoom. Same data as <code>composition-wiring.json</code>.</p>
  </header>
  <div class="toolbar">
    <button type="button" id="btn-fit">Fit view</button>
    <button type="button" id="btn-tb">Top → bottom</button>
    <button type="button" id="btn-lr">Left → right</button>
  </div>
  <div id="graph"></div>
  <script>
    (function () {
      var KIND_COLORS = ${kindColorsJson};
      var payload = ${dataJson};
      var visNodes;
      var visEdges;
      if (!payload.nodes.length) {
        visNodes = new vis.DataSet([
          {
            id: "_empty",
            label: "No graph yet\\nAdd packages under packages/composition",
            color: { background: "#e1bee7", border: "#37474f" },
            shape: "box",
            margin: 16,
            font: { color: "#111", size: 14 },
          },
        ]);
        visEdges = new vis.DataSet([]);
      } else {
        visNodes = new vis.DataSet(
          payload.nodes.map(function (n) {
            var bg = KIND_COLORS[n.kind] || "#eceff1";
            var level =
              typeof n.level === "number"
                ? n.level
                : ({ app: 0, composition: 1, application: 2, module: 3, useCase: 4, flow: 4, domainService: 5, domainEntity: 6 }[
                    n.kind
                  ] ?? 0);
            return {
              id: n.id,
              label: n.label,
              level: level,
              color: { background: bg, border: "#37474f", highlight: { background: bg, border: "#111" } },
              shape: "box",
              margin: 12,
              font: { color: "#111111", multi: true, size: 13 },
              widthConstraint: { maximum: 260 },
            };
          })
        );
        visEdges = new vis.DataSet(
          payload.edges.map(function (e, i) {
            return { id: "e" + i, from: e.from, to: e.to, arrows: "to" };
          })
        );
      }
      var container = document.getElementById("graph");
      /**
       * LR: levelSeparation = horizontal gap between columns; nodeSpacing = vertical gap between siblings.
       * UD: levelSeparation = vertical gap between ranks; nodeSpacing = horizontal gap on the same rank (raise if nodes overlap).
       * Node widthConstraint + font.multi limits box width so ranks stay predictable.
       */
      function hierarchicalOptions(direction) {
        var isLR = direction === "LR" || direction === "RL";
        return {
          layout: {
            hierarchical: {
              enabled: true,
              direction: direction,
              sortMethod: "directed",
              nodeSpacing: isLR ? 165 : 210,
              levelSeparation: isLR ? 270 : 105,
              treeSpacing: isLR ? 230 : 150,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
              shakeTowards: "roots",
            },
          },
          physics: false,
          edges: {
            color: { color: "#78909c", highlight: "#37474f" },
            smooth: {
              type: "cubicBezier",
              roundness: 0.35,
              forceDirection: isLR ? "horizontal" : "vertical",
            },
          },
        };
      }
      var options = {
        nodes: { borderWidth: 1, shadow: false, widthConstraint: { maximum: 260 } },
        interaction: { dragNodes: true, dragView: true, zoomView: true, multiselect: false },
      };
      if (payload.nodes.length) {
        Object.assign(options, hierarchicalOptions("UD"));
      } else {
        options.physics = false;
      }
      var network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
      function fitAfterLayout(animate) {
        var called = false;
        function once() {
          if (called) return;
          called = true;
          network.fit({
            animation: animate
              ? { duration: 220, easingFunction: "easeInOutQuad" }
              : false,
          });
        }
        network.once("stabilizationEnd", once);
        setTimeout(once, 400);
      }
      function setDirection(dir) {
        network.setOptions(hierarchicalOptions(dir));
        fitAfterLayout(false);
      }
      if (payload.nodes.length) {
        fitAfterLayout(true);
        document.getElementById("btn-tb").addEventListener("click", function () {
          setDirection("UD");
        });
        document.getElementById("btn-lr").addEventListener("click", function () {
          setDirection("LR");
        });
      } else {
        document.getElementById("btn-tb").disabled = true;
        document.getElementById("btn-lr").disabled = true;
      }
      document.getElementById("btn-fit").addEventListener("click", function () {
        network.fit({ animation: { duration: 280, easingFunction: "easeInOutQuad" } });
      });
    })();
  </script>
</body>
</html>`;
}

/**
 * @param {string} mermaidSource
 * @returns {string}
 */
function wiringMermaidToHtml(mermaidSource) {
  const safe = mermaidSource.replace(/&/g, "&amp;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Composition wiring graph</title>
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
  <h1>Composition wiring (apps, application, domain)</h1>
  <p class="hint">Derived from file paths and import strings only (no extra metadata). <strong>Apps</strong>: <code>apps/&lt;name&gt;/src/**/*.{ts,tsx}</code> referencing <code>@composition/&lt;pkg&gt;</code> (existing composition packages only). <strong>Composition → application</strong>: scan composition <code>src</code> for <code>@application/&lt;pkg&gt;/…</code>. <strong>Modules</strong> and <strong>use-case / flow</strong> wiring unchanged. <strong>Domain</strong>: from each <code>*.use-case.ts</code> and <code>*.flow.ts</code>, parse <code>@domain/&lt;pkg&gt;/entities</code> and <code>…/services</code> (barrel or subpath); edges only if the matching <code>.entity.ts</code> / <code>.service.ts</code> exists. <strong>Domain service → entity</strong>: for each domain service reached from a use-case/flow, parse the same <code>@domain/…/entities</code> patterns plus <code>../entities</code> relatives from that <code>.service.ts</code>. <strong>Domain nodes</strong> are labeled with the <strong>PascalCase</strong> class name (import symbol for barrels; first <code>export class</code> in the slice file for subpath, with a kebab→Pascal fallback if needed).</p>
  <pre class="mermaid">${safe}</pre>
</body>
</html>`;
}

module.exports = {
  buildCompositionWiringGraph,
  toWiringMermaid,
  toWiringGraphJson,
  wiringMermaidToHtml,
  wiringInteractiveVisHtml,
  hierarchicalLevelForKind,
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
