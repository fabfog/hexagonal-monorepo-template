"use strict";

const fs = require("fs");
const path = require("path");

/** @typedef {{ id: string, layer: string, label: string }} PkgNode */

const LAYER_COLORS = {
  application: "#c8e6c9",
  domain: "#bbdefb",
  infrastructure: "#ffe0b2",
  composition: "#e1bee7",
  ui: "#f8bbd0",
  default: "#eceff1",
};

/**
 * @param {string} filePath posix-ish path relative to repo root or absolute
 * @param {string} repoRoot
 * @returns {{ id: string, layer: string, label: string } | null}
 */
function packageFromFilePath(filePath, repoRoot) {
  const norm = path.normalize(filePath).replace(/\\/g, "/");
  const rel = path.isAbsolute(norm) ? path.relative(repoRoot, norm).replace(/\\/g, "/") : norm;
  const m = rel.match(/^packages\/([^/]+)\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  const layer = m[1];
  const name = m[2];
  return { id: `${layer}/${name}`, layer, label: `${layer}\n${name}` };
}

/**
 * @param {unknown} cruiseJson parsed dependency-cruiser json output
 * @param {string} repoRoot
 * @returns {{ nodes: Map<string, PkgNode>, edges: Set<string> }}
 */
function aggregatePackageGraph(cruiseJson, repoRoot) {
  const nodes = new Map();
  const edges = new Set();

  const modules = cruiseJson.modules || [];
  for (const mod of modules) {
    const fromPkg = packageFromFilePath(mod.source, repoRoot);
    if (!fromPkg) continue;
    nodes.set(fromPkg.id, fromPkg);

    for (const dep of mod.dependencies || []) {
      if (!dep.resolved || dep.couldNotResolve) continue;
      const toPkg = packageFromFilePath(dep.resolved, repoRoot);
      if (!toPkg) continue;
      if (fromPkg.id === toPkg.id) continue;
      nodes.set(toPkg.id, toPkg);
      edges.add(`${fromPkg.id}->${toPkg.id}`);
    }
  }

  return { nodes, edges };
}

/**
 * Add edges from workspace `dependencies` / `devDependencies` in each package's package.json
 * (`workspace:*` / `workspace:^`). Maps `@layer/name` → `packages/layer/name`.
 * @param {string} repoRoot
 * @param {Map<string, PkgNode>} nodes
 * @param {Set<string>} edges
 */
function mergeWorkspaceManifestEdges(repoRoot, nodes, edges) {
  const packagesRoot = path.join(repoRoot, "packages");
  if (!fs.existsSync(packagesRoot)) return;

  for (const layer of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!layer.isDirectory()) continue;
    const layerName = layer.name;
    const layerDir = path.join(packagesRoot, layerName);
    for (const pkg of fs.readdirSync(layerDir, { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      const pkgName = pkg.name;
      const pkgJsonPath = path.join(layerDir, pkgName, "package.json");
      if (!fs.existsSync(pkgJsonPath)) continue;

      const fromId = `${layerName}/${pkgName}`;
      nodes.set(fromId, { id: fromId, layer: layerName, label: `${layerName}\n${pkgName}` });

      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      } catch {
        continue;
      }

      const allDeps = { ...manifest.dependencies, ...manifest.devDependencies };
      for (const [depName, range] of Object.entries(allDeps)) {
        if (typeof range !== "string" || !range.startsWith("workspace:")) continue;
        const m = depName.match(/^@(domain|application|infrastructure|composition|ui)\/(.+)$/);
        if (!m) continue;
        const toLayer = m[1];
        const toName = m[2];
        const toPath = path.join(packagesRoot, toLayer, toName, "package.json");
        if (!fs.existsSync(toPath)) continue;
        const toId = `${toLayer}/${toName}`;
        nodes.set(toId, { id: toId, layer: toLayer, label: `${toLayer}\n${toName}` });
        edges.add(`${fromId}->${toId}`);
      }
    }
  }
}

/**
 * @param {Map<string, PkgNode>} nodes
 * @param {Set<string>} edges "a->b"
 * @returns {string} Graphviz DOT
 */
function toDot(nodes, edges) {
  const lines = [
    'strict digraph "packages" {',
    '  graph [rankdir=LR; splines=true; overlap=false; nodesep=0.35; ranksep=0.5; fontname="Helvetica"];',
    '  node [shape=box; style="rounded,filled"; fontname="Helvetica"; fontsize=11];',
    '  edge [color="#37474f88"; penwidth=1.2];',
    "",
  ];

  const layerOrder = ["domain", "application", "infrastructure", "composition", "ui"];
  const byLayer = new Map();
  for (const layer of layerOrder) byLayer.set(layer, []);
  for (const node of nodes.values()) {
    if (!byLayer.has(node.layer)) byLayer.set(node.layer, []);
    byLayer.get(node.layer).push(node);
  }

  for (const layer of layerOrder) {
    const list = byLayer.get(layer) || [];
    if (list.length === 0) continue;
    list.sort((a, b) => a.id.localeCompare(b.id));
    const color = LAYER_COLORS[layer] || LAYER_COLORS.default;
    const clusterId = `cluster_${layer.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    lines.push(`  subgraph "${clusterId}" {`);
    lines.push(`    label="${layer}"; style=rounded; bgcolor="${color}44"; fontcolor="#263238";`);
    for (const n of list) {
      const nid = n.id.replace(/[^a-zA-Z0-9_]/g, "_");
      const label = n.id.replace(/"/g, '\\"');
      lines.push(`    "${nid}" [label="${label}"; fillcolor="${color}"];`);
    }
    lines.push("  }");
    lines.push("");
  }

  const extraLayers = [...byLayer.keys()].filter((l) => !layerOrder.includes(l));
  extraLayers.sort();
  for (const layer of extraLayers) {
    const list = byLayer.get(layer) || [];
    if (list.length === 0) continue;
    list.sort((a, b) => a.id.localeCompare(b.id));
    const color = LAYER_COLORS.default;
    const clusterId = `cluster_${layer.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    lines.push(`  subgraph "${clusterId}" {`);
    lines.push(`    label="${layer}"; style=rounded; bgcolor="${color}44"; fontcolor="#263238";`);
    for (const n of list) {
      const nid = n.id.replace(/[^a-zA-Z0-9_]/g, "_");
      const label = n.id.replace(/"/g, '\\"');
      lines.push(`    "${nid}" [label="${label}"; fillcolor="${color}"];`);
    }
    lines.push("  }");
    lines.push("");
  }

  for (const e of [...edges].sort()) {
    const [from, to] = e.split("->");
    lines.push(
      `  "${from.replace(/[^a-zA-Z0-9_]/g, "_")}" -> "${to.replace(/[^a-zA-Z0-9_]/g, "_")}";`
    );
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * @param {Map<string, PkgNode>} nodes
 * @param {Set<string>} edges
 * @returns {string} Mermaid flowchart (no subgraph strict layer box - use classDef)
 */
function toMermaid(nodes, edges) {
  const lines = ["flowchart LR"];
  const colorEntries = Object.entries(LAYER_COLORS).filter(([k]) => k !== "default");
  for (const [layer, color] of colorEntries) {
    lines.push(`  classDef layer_${layer} fill:${color},stroke:#37474f,color:#111;`);
  }
  lines.push("  classDef layer_default fill:#eceff1,stroke:#37474f,color:#111;");

  const sortedNodes = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const n of sortedNodes) {
    const mid = n.id.replace(/[^a-zA-Z0-9_]/g, "_");
    const label = n.id.replace(/"/g, "#quot;");
    const cls = LAYER_COLORS[n.layer] ? n.layer : "default";
    lines.push(`  ${mid}["${label}"]:::layer_${cls}`);
  }

  for (const e of [...edges].sort()) {
    const [from, to] = e.split("->");
    lines.push(`  ${from.replace(/[^a-zA-Z0-9_]/g, "_")} --> ${to.replace(/[^a-zA-Z0-9_]/g, "_")}`);
  }

  return lines.join("\n");
}

/**
 * @param {string} mermaidSource
 * @returns {string} standalone HTML
 */
function mermaidToHtml(mermaidSource) {
  const safe = mermaidSource.replace(/&/g, "&amp;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Package dependency graph</title>
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
  <h1>Package-level dependency graph</h1>
  <p class="hint">One node per <code>packages/&lt;layer&gt;/&lt;name&gt;</code>. <strong>Edges</strong> are the union of (1) <code>workspace:*</code> / <code>workspace:^</code> dependencies in each package <code>package.json</code> for scopes <code>@domain/*</code>, <code>@application/*</code>, <code>@infrastructure/*</code>, <code>@composition/*</code>, <code>@ui/*</code>, and (2) cross-package links inferred from dependency-cruiser when a resolved import crosses package folders.</p>
  <pre class="mermaid">${safe}</pre>
</body>
</html>`;
}

module.exports = {
  aggregatePackageGraph,
  mergeWorkspaceManifestEdges,
  packageFromFilePath,
  toDot,
  toMermaid,
  mermaidToHtml,
  LAYER_COLORS,
};
