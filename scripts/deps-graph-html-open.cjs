#!/usr/bin/env node
/**
 * Package-level dependency graph: aggregate dependency-cruiser JSON into one node per
 * packages/<layer>/<name>, colored by layer, rendered as Mermaid in HTML (opens in browser).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");
const {
  aggregatePackageGraph,
  mergeWorkspaceManifestEdges,
  toDot,
  toMermaid,
  mermaidToHtml,
} = require("./lib/package-dependency-graph.cjs");

const repoRoot = path.join(__dirname, "..");
const outDir = path.join(repoRoot, ".dependency-cruiser-report");
const htmlOut = path.join(outDir, "index.html");
const dotOut = path.join(outDir, "packages.dot");
const mmdOut = path.join(outDir, "packages.mmd");

fs.mkdirSync(outDir, { recursive: true });

const dep = spawnSync(
  "pnpm",
  [
    "exec",
    "depcruise",
    "--config",
    ".dependency-cruiser.graph.cjs",
    "packages",
    "-p",
    "--output-type",
    "json",
    "--output-to",
    "-",
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    shell: process.platform === "win32",
  }
);

if (dep.error) {
  console.error("[deps:graph] depcruise failed:", dep.error.message);
  process.exit(1);
}
if (dep.status !== 0) {
  console.error(dep.stderr || dep.stdout);
  process.exit(dep.status ?? 1);
}

let cruise;
try {
  cruise = JSON.parse(dep.stdout);
} catch {
  console.error("[deps:graph] invalid JSON from depcruise");
  process.exit(1);
}

const { nodes, edges } = aggregatePackageGraph(cruise, repoRoot);
mergeWorkspaceManifestEdges(repoRoot, nodes, edges);

if (nodes.size === 0) {
  console.error("[deps:graph] no packages under packages/<layer>/<name> found.");
  process.exit(1);
}

const mermaid = toMermaid(nodes, edges);
fs.writeFileSync(mmdOut, `${mermaid}\n`, "utf8");
fs.writeFileSync(dotOut, `${toDot(nodes, edges)}\n`, "utf8");
fs.writeFileSync(htmlOut, mermaidToHtml(mermaid), "utf8");

const dotSvg = spawnSync("dot", ["-T", "svg", "-o", path.join(outDir, "packages.svg"), dotOut], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (dotSvg.status === 0) {
  console.log(`[deps:graph] also wrote packages.svg (Graphviz)`);
} else {
  console.log(`[deps:graph] skip packages.svg (install graphviz "dot" for SVG export)`);
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
  `[deps:graph] ${nodes.size} packages, ${edges.size} edges → ${path.relative(repoRoot, htmlOut)}`
);
