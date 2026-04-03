"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Graph: composition package → application packages (from @application imports) → *.module.ts
 * → use-cases / flows referenced in module source (path regex only, no metadata).
 */

/** @typedef {"composition" | "application" | "module" | "useCase" | "flow"} NodeKind */

/** @typedef {{ id: string, kind: NodeKind, label: string }} WiringNode */

/** @typedef {{ from: string, to: string }} WiringEdge */

const KIND_COLORS = {
  composition: "#e1bee7",
  application: "#c8e6c9",
  module: "#fff9c4",
  useCase: "#b3e5fc",
  flow: "#ffccbc",
};

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkTsFiles(dir) {
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
      if (!e.isFile() || !e.name.endsWith(".ts")) continue;
      if (e.name.endsWith(".test.ts") || e.name.endsWith(".spec.ts")) continue;
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
  const re = /@application\/([^/"'\s]+)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const first = m[1].split("/")[0];
    if (first) names.add(first);
  }
  return [...names];
}

/**
 * @param {string} moduleFileContent
 * @returns {{ useCases: string[], flows: string[] }}
 */
function extractWiredSlicesFromModuleSource(moduleFileContent) {
  const useCases = new Set();
  const flows = new Set();

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
    while ((m = re.exec(moduleFileContent)) !== null) useCases.add(m[1]);
  }
  for (const re of flowPatterns) {
    let m;
    while ((m = re.exec(moduleFileContent)) !== null) flows.add(m[1]);
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

  for (const compName of compDirs) {
    const cid = `c_${mermaidSafeId(compName)}`;
    addNode(cid, "composition", `@composition/${compName}`);

    const srcDir = path.join(compositionRoot, compName, "src");
    const appNames = new Set();
    for (const file of walkTsFiles(srcDir)) {
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
        }
      }
    }
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
  <h1>Composition → application → modules → use-cases &amp; flows</h1>
  <p class="hint">Derived from file paths and import strings only (no extra metadata). <strong>Composition</strong> packages: scan <code>packages/composition/&lt;name&gt;/src/**/*.ts</code> for <code>@application/&lt;pkg&gt;/…</code>. <strong>Modules</strong>: <code>packages/application/&lt;pkg&gt;/src/modules/*.module.ts</code>. <strong>Wires</strong>: regex on module source for <code>../use-cases/&lt;kebab&gt;.use-case</code> and <code>../flows/&lt;kebab&gt;.flow</code> (or <code>@application/&lt;pkg&gt;/use-cases|flows/…</code>); an edge is drawn only if the matching <code>.use-case.ts</code> / <code>.flow.ts</code> file exists.</p>
  <pre class="mermaid">${safe}</pre>
</body>
</html>`;
}

module.exports = {
  buildCompositionWiringGraph,
  toWiringMermaid,
  wiringMermaidToHtml,
  KIND_COLORS,
  walkTsFiles,
  extractApplicationPackageNames,
  extractWiredSlicesFromModuleSource,
};
