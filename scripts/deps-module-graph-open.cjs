#!/usr/bin/env node
/**
 * Application module drill-down graph: one `*.module.ts` → wired use-cases & flows → imported
 * application ports → domain
 * (same heuristics as the legacy full composition graph; see scripts/lib/composition-wiring-graph.cjs).
 *
 * Usage:
 *   pnpm deps:graph:module -- packages/application/<app>/src/modules/<kebab>.module.ts
 *   pnpm deps:graph:module -- <app-folder>/<kebab>.module   (same label as composition wiring graph)
 *   node scripts/deps-module-graph-open.cjs <path-or-label>
 *
 * Path may be relative to the repo root or absolute. Writes under depcruiser-reports/ and opens
 * the Mermaid HTML (static diagram), plus `.mmd` / JSON / `.dot` beside it.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");
const {
  buildApplicationModuleWiringGraph,
  resolveApplicationModuleFileArg,
  toWiringMermaid,
  toWiringGraphJson,
  wiringMermaidToHtml,
  hierarchicalLevelForModuleDetailRoot,
} = require("./lib/composition-wiring-graph.cjs");

const repoRoot = path.join(__dirname, "..");

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const argv = process.argv.slice(2).filter((a) => a !== "--");
const userPath = argv[0];

if (!userPath) {
  console.error(
    "[deps:graph:module] Missing path or composition-graph label.\n" +
      "Examples:\n" +
      "  pnpm deps:graph:module -- packages/application/demo-support/src/modules/support-inbox.module.ts\n" +
      "  pnpm deps:graph:module -- demo-support/support-inbox.module"
  );
  process.exit(1);
}

const moduleAbs = resolveApplicationModuleFileArg(repoRoot, userPath);
if (!moduleAbs) {
  console.error(
    `[deps:graph:module] Not a valid application module under the repo:\n  ${userPath}\n` +
      "Use a path like packages/application/<pkg>/src/modules/<kebab>.module.ts, or the graph label <pkg>/<kebab>.module"
  );
  process.exit(1);
}

const rel = path.relative(repoRoot, moduleAbs).replace(/\\/g, "/");
const stemMatch = rel.match(
  /^packages\/application\/([^/]+)\/src\/modules\/([a-z0-9-]+)\.module\.ts$/
);
const appName = stemMatch ? stemMatch[1] : "app";
const base = stemMatch ? stemMatch[2] : "module";

const outDir = path.join(repoRoot, "depcruiser-reports");
fs.mkdirSync(outDir, { recursive: true });

const slug = `${appName}-${base}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
const mmdOut = path.join(outDir, `module-wiring-${slug}.mmd`);
const htmlOut = path.join(outDir, `module-wiring-${slug}.html`);
const jsonOut = path.join(outDir, `module-wiring-${slug}.json`);
const dotOut = path.join(outDir, `module-wiring-${slug}.dot`);

let nodes;
let edges;
try {
  ({ nodes, edges } = buildApplicationModuleWiringGraph(repoRoot, moduleAbs));
} catch (e) {
  console.error("[deps:graph:module]", e.message || e);
  process.exit(1);
}

let mermaid;
if (nodes.size === 0) {
  mermaid = [
    "flowchart TB",
    "  classDef kind_module fill:#fff9c4,stroke:#37474f,color:#111;",
    '  _empty["Empty module graph"]:::kind_module',
  ].join("\n");
} else {
  mermaid = toWiringMermaid(nodes, edges);
}

const moduleHint = `Single module: <code>${escapeHtml(rel)}</code>. <strong>Module</strong> → wired <code>*.use-case.ts</code> / <code>*.flow.ts</code> (from module source patterns) → imported <strong>application ports</strong> and <strong>domain</strong> entity &amp; service imports in those files, then service → entity edges. Same rules as the full composition graph.`;

fs.writeFileSync(mmdOut, `${mermaid}\n`, "utf8");
fs.writeFileSync(
  htmlOut,
  wiringMermaidToHtml(mermaid, {
    title: `Module wiring — ${appName}/${base}.module`,
    heading: `Module wiring — ${rel}`,
    hint: moduleHint,
  }),
  "utf8"
);

const wiringPayload = toWiringGraphJson(nodes, edges, hierarchicalLevelForModuleDetailRoot);
fs.writeFileSync(jsonOut, `${JSON.stringify(wiringPayload, null, 2)}\n`, "utf8");

const kindFill = {
  module: "#fff9c4",
  useCase: "#b3e5fc",
  flow: "#ffccbc",
  port: "#d1c4e9",
  domainEntity: "#90caf9",
  domainService: "#64b5f6",
};

function dotId(id) {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

const dotLines = [
  'strict digraph "module_wiring" {',
  '  graph [rankdir=TB; splines=true; fontname="Helvetica"];',
  '  node [shape=box; style="rounded,filled"; fontname="Helvetica"; fontsize=10];',
  '  edge [color="#37474f88"];',
  "",
];

for (const n of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const fill = kindFill[n.kind] || "#eceff1";
  const label = n.label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  dotLines.push(`  "${dotId(n.id)}" [label="${label}"; fillcolor="${fill}"];`);
}
for (const e of edges) {
  dotLines.push(`  "${dotId(e.from)}" -> "${dotId(e.to)}";`);
}
dotLines.push("}");

fs.writeFileSync(dotOut, `${dotLines.join("\n")}\n`, "utf8");

const dotSvg = spawnSync(
  "dot",
  ["-T", "svg", "-o", path.join(outDir, `module-wiring-${slug}.svg`), dotOut],
  { cwd: repoRoot, encoding: "utf8" }
);
if (dotSvg.status === 0) {
  console.log(`[deps:graph:module] also wrote module-wiring-${slug}.svg (Graphviz)`);
} else {
  console.log('[deps:graph:module] skip SVG (install graphviz "dot")');
}

function openInBrowser(filePath) {
  if (process.platform === "darwin") {
    spawnSync("open", [filePath], { stdio: "ignore" });
  } else if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/c", "start", "", filePath], { stdio: "ignore" });
  } else {
    spawnSync("xdg-open", [filePath], { stdio: "ignore" });
  }
}

openInBrowser(path.resolve(htmlOut));
console.log(
  `[deps:graph:module] ${nodes.size} nodes, ${edges.length} edges → opened ${path.relative(repoRoot, htmlOut)} (Mermaid)`
);
console.log(
  `[deps:graph:module] also: ${path.relative(repoRoot, jsonOut)}, ${path.relative(repoRoot, htmlOut)} (Mermaid), ${path.relative(repoRoot, mmdOut)}`
);
