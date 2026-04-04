"use strict";

const fs = require("fs");
const path = require("path");

/** @typedef {{ id: string, layer: string, label: string }} PkgNode */

const LAYER_COLORS = {
  app: "#c5cae9",
  application: "#c8e6c9",
  domain: "#bbdefb",
  infrastructure: "#ffe0b2",
  composition: "#e1bee7",
  ui: "#f8bbd0",
  default: "#eceff1",
};

/**
 * Hierarchical rank for vis-network (UD: smaller = top, LR: smaller = left).
 * apps → composition → application → domain → infrastructure (ui shares the outer tier with apps).
 * @param {string} layer e.g. app, ui, composition, application, domain, infrastructure
 * @returns {number}
 */
function hierarchicalLevelForLayer(layer) {
  switch (layer) {
    case "app":
      return 0;
    case "ui":
      return 0;
    case "composition":
      return 1;
    case "application":
      return 2;
    case "domain":
      return 3;
    case "infrastructure":
      return 4;
    default:
      return 3;
  }
}

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
 * Runnable apps under apps/*: one node per app, edges from workspace deps to packages/*.
 * @param {string} repoRoot
 * @param {Map<string, PkgNode>} nodes
 * @param {Set<string>} edges
 */
function mergeAppWorkspaceEdges(repoRoot, nodes, edges) {
  const appsRoot = path.join(repoRoot, "apps");
  const packagesRoot = path.join(repoRoot, "packages");
  if (!fs.existsSync(appsRoot)) return;

  for (const ent of fs.readdirSync(appsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const appName = ent.name;
    const pkgJsonPath = path.join(appsRoot, appName, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    const fromId = `apps/${appName}`;
    nodes.set(fromId, { id: fromId, layer: "app", label: `apps\n${appName}` });

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

  const layerOrder = ["app", "ui", "composition", "application", "domain", "infrastructure"];
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
 * Portable snapshot for vis-network / other tools.
 * @param {Map<string, PkgNode>} nodes
 * @param {Set<string>} edges keys "fromId->toId"
 * @returns {{ nodes: Array<{ id: string, label: string, layer: string, level: number }>, edges: Array<{ from: string, to: string }> }}
 */
function toPackageGraphJson(nodes, edges) {
  const nodeList = [...nodes.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      label: n.label,
      layer: n.layer,
      level: hierarchicalLevelForLayer(n.layer),
    }));
  const edgeList = [...edges]
    .sort()
    .map((s) => {
      const arrow = s.indexOf("->");
      const from = arrow === -1 ? s : s.slice(0, arrow);
      const to = arrow === -1 ? "" : s.slice(arrow + 2);
      return { from, to };
    })
    .filter((e) => e.from && e.to);
  return { nodes: nodeList, edges: edgeList };
}

/**
 * Self-contained HTML: vis-network + embedded JSON (works from file://).
 * @param {{ nodes: Array<{ id: string, label: string, layer: string, level?: number }>, edges: Array<{ from: string, to: string }> }} payload
 * @returns {string}
 */
function packageGraphInteractiveVisHtml(payload) {
  const layerColorsJson = JSON.stringify(LAYER_COLORS).replace(/</g, "\\u003c");
  const dataJson = JSON.stringify(payload).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Package dependency graph (interactive)</title>
  <script src="https://cdn.jsdelivr.net/npm/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; background: #f5f5f5; color: #263238; }
    header { padding: 0.75rem 1rem; background: #fff; border-bottom: 1px solid #e0e0e0; }
    h1 { font-size: 1rem; margin: 0 0 0.35rem; }
    .hint { font-size: 0.8rem; color: #546e7a; max-width: 48rem; line-height: 1.4; margin: 0; }
    #graph { width: 100%; height: calc(100vh - 6.5rem); background: #fafafa; }
    .toolbar { padding: 0.35rem 1rem; background: #eee; font-size: 0.8rem; color: #455a64; display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.75rem; }
    .toolbar button {
      padding: 0.25rem 0.6rem;
      font-size: 0.8rem;
      cursor: pointer;
      border: 1px solid #b0bec5;
      border-radius: 4px;
      background: #fff;
    }
    .toolbar button:hover { background: #eceff1; }
    .toolbar-group { display: inline-flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; }
    .toolbar-group .tb-label { color: #546e7a; white-space: nowrap; }
    .toolbar-group .tb-val { min-width: 2.25rem; text-align: center; font-variant-numeric: tabular-nums; color: #263238; }
    .toolbar-sep { color: #b0bec5; user-select: none; }
  </style>
</head>
<body>
  <header>
    <h1>Package dependency graph — interactive (vis-network)</h1>
    <p class="hint">Nodes: <code>apps/&lt;name&gt;</code> and <code>packages/&lt;layer&gt;/&lt;name&gt;</code>. Hierarchical ranks: apps / ui → composition → application → domain → infrastructure. Use <strong>Level gap</strong> / <strong>Sibling gap</strong> ± to tune spacing (values are remembered separately for top–bottom vs left–right). Same data as <code>packages-graph.json</code>.</p>
  </header>
  <div class="toolbar">
    <button type="button" id="btn-fit">Fit view</button>
    <button type="button" id="btn-tb">Top → bottom</button>
    <button type="button" id="btn-lr">Left → right</button>
    <span class="toolbar-sep" aria-hidden="true">|</span>
    <span class="toolbar-group" title="Top–bottom: vertical gap between ranks. Left–right: horizontal gap between columns.">
      <span class="tb-label">Level gap</span>
      <button type="button" id="btn-level-minus" aria-label="Decrease level gap">−</button>
      <span class="tb-val" id="val-level-gap">—</span>
      <button type="button" id="btn-level-plus" aria-label="Increase level gap">+</button>
    </span>
    <span class="toolbar-group" title="Top–bottom: horizontal gap on same rank. Left–right: vertical gap between siblings.">
      <span class="tb-label">Sibling gap</span>
      <button type="button" id="btn-node-minus" aria-label="Decrease sibling gap">−</button>
      <span class="tb-val" id="val-node-gap">—</span>
      <button type="button" id="btn-node-plus" aria-label="Increase sibling gap">+</button>
    </span>
  </div>
  <div id="graph"></div>
  <script>
    (function () {
      var LAYER_COLORS = ${layerColorsJson};
      var LAYER_LEVEL = { app: 0, ui: 0, composition: 1, application: 2, domain: 3, infrastructure: 4 };
      var payload = ${dataJson};
      var visNodes = new vis.DataSet(
        payload.nodes.map(function (n) {
          var bg = LAYER_COLORS[n.layer] || LAYER_COLORS.default;
          var level =
            typeof n.level === "number"
              ? n.level
              : LAYER_LEVEL[n.layer] !== undefined
                ? LAYER_LEVEL[n.layer]
                : 3;
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
      var visEdges = new vis.DataSet(
        payload.edges.map(function (e, i) {
          return { id: "e" + i, from: e.from, to: e.to, arrows: "to" };
        })
      );
      var container = document.getElementById("graph");
      var GAP_STEP = 15;
      var GAP_LIMITS = { levelMin: 45, levelMax: 520, nodeMin: 45, nodeMax: 480 };
      function clampGap(n, lo, hi) {
        return Math.max(lo, Math.min(hi, n));
      }
      /** Per-direction spacing (px); UD vs LR keep separate presets so toggling does not lose tweaks. */
      var spacingPresets = {
        UD: { levelSeparation: 105, nodeSpacing: 210, treeSpacing: 150 },
        LR: { levelSeparation: 175, nodeSpacing: 100, treeSpacing: 230 },
      };
      var activeLayoutKey = "UD";
      function currentSpacing() {
        return spacingPresets[activeLayoutKey];
      }
      function visDirection() {
        return activeLayoutKey === "LR" ? "LR" : "UD";
      }
      function isLRLayout() {
        return activeLayoutKey === "LR";
      }
      function buildHierarchicalNetworkOptions() {
        var dir = visDirection();
        var isLR = isLRLayout();
        var s = currentSpacing();
        return {
          layout: {
            hierarchical: {
              enabled: true,
              direction: dir,
              sortMethod: "directed",
              nodeSpacing: s.nodeSpacing,
              levelSeparation: s.levelSeparation,
              treeSpacing: s.treeSpacing,
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
      function refreshGapLabels() {
        var s = currentSpacing();
        var elL = document.getElementById("val-level-gap");
        var elN = document.getElementById("val-node-gap");
        if (elL) elL.textContent = String(s.levelSeparation);
        if (elN) elN.textContent = String(s.nodeSpacing);
      }
      function applyHierarchicalLayout(fitAnim) {
        if (!payload.nodes.length) return;
        network.setOptions(buildHierarchicalNetworkOptions());
        refreshGapLabels();
        fitAfterLayout(fitAnim);
      }
      var options = {
        nodes: { borderWidth: 1, shadow: false, widthConstraint: { maximum: 260 } },
        interaction: { dragNodes: true, dragView: true, zoomView: true, multiselect: false },
      };
      if (payload.nodes.length) {
        Object.assign(options, buildHierarchicalNetworkOptions());
      } else {
        options.physics = false;
        options.edges = { color: { color: "#78909c", highlight: "#37474f" } };
      }
      var network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
      function fitAfterLayout(animate) {
        var called = false;
        function once() {
          if (called) return;
          called = true;
          network.fit({
            animation: animate ? { duration: 220, easingFunction: "easeInOutQuad" } : false,
          });
        }
        network.once("stabilizationEnd", once);
        setTimeout(once, 400);
      }
      function setLayoutKey(key) {
        activeLayoutKey = key === "LR" ? "LR" : "UD";
        applyHierarchicalLayout(false);
      }
      function wireGapButtons() {
        document.getElementById("btn-level-minus").addEventListener("click", function () {
          var s = currentSpacing();
          s.levelSeparation = clampGap(s.levelSeparation - GAP_STEP, GAP_LIMITS.levelMin, GAP_LIMITS.levelMax);
          applyHierarchicalLayout(false);
        });
        document.getElementById("btn-level-plus").addEventListener("click", function () {
          var s = currentSpacing();
          s.levelSeparation = clampGap(s.levelSeparation + GAP_STEP, GAP_LIMITS.levelMin, GAP_LIMITS.levelMax);
          applyHierarchicalLayout(false);
        });
        document.getElementById("btn-node-minus").addEventListener("click", function () {
          var s = currentSpacing();
          s.nodeSpacing = clampGap(s.nodeSpacing - GAP_STEP, GAP_LIMITS.nodeMin, GAP_LIMITS.nodeMax);
          applyHierarchicalLayout(false);
        });
        document.getElementById("btn-node-plus").addEventListener("click", function () {
          var s = currentSpacing();
          s.nodeSpacing = clampGap(s.nodeSpacing + GAP_STEP, GAP_LIMITS.nodeMin, GAP_LIMITS.nodeMax);
          applyHierarchicalLayout(false);
        });
      }
      if (payload.nodes.length) {
        refreshGapLabels();
        fitAfterLayout(true);
        document.getElementById("btn-tb").addEventListener("click", function () {
          setLayoutKey("UD");
        });
        document.getElementById("btn-lr").addEventListener("click", function () {
          setLayoutKey("LR");
        });
        wireGapButtons();
      } else {
        document.getElementById("btn-tb").disabled = true;
        document.getElementById("btn-lr").disabled = true;
        document.getElementById("btn-level-minus").disabled = true;
        document.getElementById("btn-level-plus").disabled = true;
        document.getElementById("btn-node-minus").disabled = true;
        document.getElementById("btn-node-plus").disabled = true;
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
  <p class="hint">Nodes: each <code>packages/&lt;layer&gt;/&lt;name&gt;</code> plus each <code>apps/&lt;name&gt;</code> with a <code>package.json</code>. <strong>Edges</strong>: (1) <code>workspace:*</code> / <code>workspace:^</code> in every app and package manifest for <code>@domain/*</code>, <code>@application/*</code>, <code>@infrastructure/*</code>, <code>@composition/*</code>, <code>@ui/*</code>, and (2) cross-package links from dependency-cruiser under <code>packages/</code>.</p>
  <pre class="mermaid">${safe}</pre>
</body>
</html>`;
}

module.exports = {
  aggregatePackageGraph,
  mergeWorkspaceManifestEdges,
  mergeAppWorkspaceEdges,
  packageFromFilePath,
  toDot,
  toMermaid,
  toPackageGraphJson,
  mermaidToHtml,
  packageGraphInteractiveVisHtml,
  hierarchicalLevelForLayer,
  LAYER_COLORS,
};
