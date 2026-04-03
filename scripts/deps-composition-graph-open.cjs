#!/usr/bin/env node
/**
 * Composition wiring graph: @composition/* → @application/* → *.module.ts → use-cases & flows
 * (path / import-string heuristics only; see scripts/lib/composition-wiring-graph.cjs).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");
const {
  buildCompositionWiringGraph,
  toWiringMermaid,
  wiringMermaidToHtml,
} = require("./lib/composition-wiring-graph.cjs");

const repoRoot = path.join(__dirname, "..");
const outDir = path.join(repoRoot, ".dependency-cruiser-report");
const htmlOut = path.join(outDir, "composition-wiring.html");
const mmdOut = path.join(outDir, "composition-wiring.mmd");

fs.mkdirSync(outDir, { recursive: true });

const { nodes, edges } = buildCompositionWiringGraph(repoRoot);

let mermaid;
if (nodes.size === 0) {
  mermaid = [
    "flowchart TB",
    "  classDef kind_composition fill:#e1bee7,stroke:#37474f,color:#111;",
    '  _hint["No packages under packages/composition — add a composition package (Plop: composition-package)"]:::kind_composition',
  ].join("\n");
} else {
  mermaid = toWiringMermaid(nodes, edges);
}

fs.writeFileSync(mmdOut, `${mermaid}\n`, "utf8");
fs.writeFileSync(htmlOut, wiringMermaidToHtml(mermaid), "utf8");

const dotLines = [
  'strict digraph "composition_wiring" {',
  '  graph [rankdir=TB; splines=true; fontname="Helvetica"];',
  '  node [shape=box; style="rounded,filled"; fontname="Helvetica"; fontsize=10];',
  '  edge [color="#37474f88"];',
  "",
];

const kindFill = {
  composition: "#e1bee7",
  application: "#c8e6c9",
  module: "#fff9c4",
  useCase: "#b3e5fc",
  flow: "#ffccbc",
};

function dotId(id) {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

for (const n of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const fill = kindFill[n.kind] || "#eceff1";
  const label = n.label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  dotLines.push(`  "${dotId(n.id)}" [label="${label}"; fillcolor="${fill}"];`);
}
for (const e of edges) {
  dotLines.push(`  "${dotId(e.from)}" -> "${dotId(e.to)}";`);
}
dotLines.push("}");

const dotOut = path.join(outDir, "composition-wiring.dot");
fs.writeFileSync(dotOut, `${dotLines.join("\n")}\n`, "utf8");

const dotSvg = spawnSync(
  "dot",
  ["-T", "svg", "-o", path.join(outDir, "composition-wiring.svg"), dotOut],
  { cwd: repoRoot, encoding: "utf8" }
);
if (dotSvg.status === 0) {
  console.log("[deps:graph:composition] also wrote composition-wiring.svg (Graphviz)");
} else {
  console.log('[deps:graph:composition] skip composition-wiring.svg (install graphviz "dot")');
}

const abs = path.resolve(htmlOut);

function openInBrowser(filePath) {
  if (process.platform === "darwin") {
    spawnSync("open", [filePath], { stdio: "ignore" });
  } else if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/c", "start", "", filePath], { stdio: "ignore" });
  } else {
    spawnSync("xdg-open", [filePath], { stdio: "ignore" });
  }
}

openInBrowser(abs);
console.log(
  `[deps:graph:composition] ${nodes.size} nodes, ${edges.length} edges → ${path.relative(repoRoot, htmlOut)}`
);
