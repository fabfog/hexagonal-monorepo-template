const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { toKebabCase, toPascalCase, toCamelCase } = require("./casing.cjs");
const { applicationPortsDir } = require("./packages.cjs");

/**
 * @typedef {"use-case" | "flow"} ApplicationSliceKind
 */

/**
 * @param {ApplicationSliceKind} sliceKind
 */
function sliceFileSpec(sliceKind) {
  if (sliceKind === "use-case") {
    return {
      dir: "use-cases",
      ext: ".use-case.ts",
      depsInterfaceSuffix: "UseCaseDependencies",
    };
  }
  return {
    dir: "flows",
    ext: ".flow.ts",
    depsInterfaceSuffix: "FlowDependencies",
  };
}

/**
 * @param {string} repoRoot
 * @param {string} packageName
 * @param {ApplicationSliceKind} sliceKind
 * @param {string} sliceName raw name from Plop (same as use-case / flow name answer)
 */
function applicationSliceFilePath(repoRoot, packageName, sliceKind, sliceName) {
  const { dir, ext } = sliceFileSpec(sliceKind);
  const kebab = toKebabCase(sliceName);
  return path.join(repoRoot, "packages", "application", packageName, "src", dir, `${kebab}${ext}`);
}

/**
 * @param {ApplicationSliceKind} sliceKind
 * @param {string} sliceName
 */
function sliceDepsInterfaceName(sliceKind, sliceName) {
  return `${toPascalCase(sliceName)}${sliceFileSpec(sliceKind).depsInterfaceSuffix}`;
}

/**
 * @param {ts.SourceFile} sf
 * @param {string} interfaceName
 * @returns {ts.InterfaceDeclaration | undefined}
 */
function findInterfaceDeclaration(sf, interfaceName) {
  /** @type {ts.InterfaceDeclaration | undefined} */
  let found;

  function visit(node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      if (found) {
        throw new Error(
          `Multiple interfaces named "${interfaceName}" in file; Plop expects a single declaration.`
        );
      }
      found = node;
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return found;
}

/**
 * Character index of the `}` that closes the interface body (insert new members before this).
 * @param {ts.SourceFile} sf
 * @param {ts.InterfaceDeclaration} intf
 */
function getInterfaceCloseBraceIndex(sf, intf) {
  for (const child of intf.getChildren(sf)) {
    if (child.kind === ts.SyntaxKind.CloseBraceToken) {
      return child.getStart(sf);
    }
  }
  throw new Error(`Could not find closing "}" for interface "${intf.name.text}".`);
}

/**
 * @param {ts.SourceFile} sf
 * @param {ts.InterfaceDeclaration} intf
 */
function inferIndentFromInterface(sf, intf) {
  for (const member of intf.members) {
    if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
    const full = sf.getFullText();
    const nameStart = member.name.getStart(sf);
    let lineStart = nameStart;
    while (lineStart > 0 && full[lineStart - 1] !== "\n") {
      lineStart--;
    }
    const prefix = full.slice(lineStart, nameStart);
    if (/^\s*$/.test(prefix)) {
      return prefix;
    }
  }
  return "  ";
}

/**
 * Parse `export interface <interfaceName> { ... }` via TypeScript AST.
 * Returns property names and full type text, plus `closeIdx` for inserting before the closing `}`.
 * @param {string} source
 * @param {string} interfaceName
 * @returns {{ body: string, closeIdx: number, properties: { name: string, type: string }[], indent: string }}
 */
function parseDependenciesInterface(source, interfaceName) {
  const fileName = "slice-deps.ts";
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const intf = findInterfaceDeclaration(sf, interfaceName);
  if (!intf) {
    throw new Error(`Could not find interface "${interfaceName}" in file.`);
  }

  /** @type {{ name: string, type: string }[]} */
  const properties = [];
  for (const member of intf.members) {
    if (!ts.isPropertySignature(member)) continue;
    if (!member.name || !ts.isIdentifier(member.name)) continue;
    if (!member.type) continue;
    properties.push({
      name: member.name.text,
      type: member.type.getText(sf).trim(),
    });
  }

  const closeIdx = getInterfaceCloseBraceIndex(sf, intf);
  const indent = inferIndentFromInterface(sf, intf);
  const body = source.slice(intf.members.pos, closeIdx);

  return { body, closeIdx, properties, indent };
}

function insertAfterLastImport(src, importLine) {
  const lines = src.split("\n");
  let lastImport = -1;
  for (let j = 0; j < lines.length; j++) {
    if (/^\s*import\s+/.test(lines[j])) lastImport = j;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine, "");
  } else {
    lines.unshift(importLine, "");
  }
  return lines.join("\n");
}

function extractPortInterfaceName(portSource) {
  const match = portSource.match(/export\s+interface\s+([A-Za-z0-9_]+)/);
  if (!match) {
    throw new Error("Could not extract `export interface <Name>` from port file.");
  }
  return match[1];
}

/**
 * @param {string} portFileName e.g. `ticket.repository.port.ts`
 */
function computeDefaultPortPropertyName(portFileName) {
  const base = String(portFileName).replace(/\.ts$/, "");
  const withoutPortSuffix = base.replace(/\.port$/, "");
  const normalized = withoutPortSuffix.replace(/\./g, "-");
  return toCamelCase(normalized);
}

/**
 * @param {string} repoRoot
 * @param {string} applicationPackage
 * @returns {{ portFileName: string, interfaceName: string, kind: string, defaultPropertyName: string }[]}
 */
function listPortsForApplication(repoRoot, applicationPackage) {
  const portsDir = applicationPortsDir(repoRoot, applicationPackage);
  if (!fs.existsSync(portsDir)) return [];

  return fs
    .readdirSync(portsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".port.ts") &&
        entry.name !== "index.ts" &&
        !entry.name.endsWith(".test.ts")
    )
    .map((entry) => {
      const portSource = fs.readFileSync(path.join(portsDir, entry.name), "utf8");
      const interfaceName = extractPortInterfaceName(portSource);

      const kind = entry.name.endsWith(".interaction.port.ts")
        ? "interaction"
        : entry.name.endsWith(".repository.port.ts")
          ? "repository"
          : "port";

      return {
        portFileName: entry.name,
        interfaceName,
        kind,
        defaultPropertyName: computeDefaultPortPropertyName(entry.name),
      };
    });
}

/**
 * Plop `choices` for ports not yet listed on the slice deps interface (by port interface type name).
 * @param {string} repoRoot
 * @param {{
 *   packageName: string,
 *   sliceKind: ApplicationSliceKind,
 *   sliceName: string,
 *   portApplicationPackage: string,
 *   sliceFileLabel: string,
 *   allPortsPresentMessage: string,
 * }} opts
 */
function portChoicesNotYetInSliceDeps(repoRoot, opts) {
  const {
    packageName,
    sliceKind,
    sliceName,
    portApplicationPackage,
    sliceFileLabel,
    allPortsPresentMessage,
  } = opts;

  const absPath = applicationSliceFilePath(repoRoot, packageName, sliceKind, sliceName);
  if (!fs.existsSync(absPath)) {
    throw new Error(`${sliceFileLabel} file not found: ${absPath}`);
  }

  const depsName = sliceDepsInterfaceName(sliceKind, sliceName);
  const source = fs.readFileSync(absPath, "utf8");
  const { properties } = parseDependenciesInterface(source, depsName);
  const existingTypes = new Set(properties.map((p) => p.type));

  const ports = listPortsForApplication(repoRoot, portApplicationPackage);
  if (!ports.length) {
    throw new Error(
      `No port files found in src/ports for application "${portApplicationPackage}".`
    );
  }

  const filtered = ports.filter((p) => !existingTypes.has(p.interfaceName));
  if (!filtered.length) {
    throw new Error(allPortsPresentMessage);
  }

  return filtered.map((p) => ({
    name: `${p.interfaceName} (${p.portFileName})`,
    value: p.portFileName,
  }));
}

/**
 * @param {string} value
 * @param {object} answers
 * @param {string} repoRoot
 * @param {ApplicationSliceKind} sliceKind
 * @param {string} sliceName
 */
function validatePortPropertyName(value, answers, repoRoot, sliceKind, sliceName) {
  const v = String(value || "").trim();
  if (!v) return "Property name cannot be empty";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) return "Use a valid identifier";

  const packageName = answers.packageName;
  const absPath = applicationSliceFilePath(repoRoot, packageName, sliceKind, sliceName);
  const depsName = sliceDepsInterfaceName(sliceKind, sliceName);
  const source = fs.readFileSync(absPath, "utf8");
  const { properties } = parseDependenciesInterface(source, depsName);
  const existingNames = new Set(properties.map((p) => p.name));
  if (existingNames.has(v)) return "Collision: pick another property name.";

  return true;
}

/**
 * @param {string} repoRoot
 * @param {string} portApplicationPackage
 * @param {string} portFileName
 */
function defaultPortPropertyName(repoRoot, portApplicationPackage, portFileName) {
  const ports = listPortsForApplication(repoRoot, portApplicationPackage);
  const selected = ports.find((p) => p.portFileName === portFileName);
  return selected?.defaultPropertyName ?? "port";
}

/**
 * @param {string} repoRoot
 * @param {{
 *   packageName: string,
 *   sliceKind: ApplicationSliceKind,
 *   sliceName: string,
 *   portApplicationPackage: string,
 *   portFileName: string,
 *   portPropertyName: string,
 * }} opts
 * @returns {import('plop').ActionType[]}
 */
function buildAddPortDependencyToSliceActions(repoRoot, opts) {
  const {
    packageName,
    sliceKind,
    sliceName,
    portApplicationPackage,
    portFileName,
    portPropertyName,
  } = opts;

  const kebab = toKebabCase(sliceName);
  const depsInterfaceNameResolved = sliceDepsInterfaceName(sliceKind, sliceName);
  const { dir, ext } = sliceFileSpec(sliceKind);
  const modifyPath = `../packages/application/${packageName}/src/${dir}/${kebab}${ext}`;

  const absPath = applicationSliceFilePath(repoRoot, packageName, sliceKind, sliceName);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Slice file not found: ${absPath}`);
  }

  const ports = listPortsForApplication(repoRoot, portApplicationPackage);
  const selectedPort = ports.find((p) => p.portFileName === portFileName);
  if (!selectedPort) {
    throw new Error("Selected port not found (unexpected).");
  }

  const portInterfaceName = selectedPort.interfaceName;
  const importLine = `import type { ${portInterfaceName} } from "@application/${portApplicationPackage}/ports";`;

  /** @type {import('plop').ActionType[]} */
  const actions = [];

  actions.push({
    type: "modify",
    path: modifyPath,
    transform: (file) => {
      let updated = file;

      if (!updated.includes(importLine)) {
        updated = insertAfterLastImport(updated, importLine);
      }

      const { closeIdx, properties, indent } = parseDependenciesInterface(
        updated,
        depsInterfaceNameResolved
      );
      const existingTypes = new Set(properties.map((p) => p.type));
      if (existingTypes.has(portInterfaceName)) {
        return updated;
      }

      const propertyLine = indent
        ? `${indent}${portPropertyName}: ${portInterfaceName};`
        : `  ${portPropertyName}: ${portInterfaceName};`;

      updated = updated.slice(0, closeIdx) + `${propertyLine}\n` + updated.slice(closeIdx);
      return updated;
    },
  });

  if (portApplicationPackage !== packageName) {
    actions.push({
      type: "modify",
      path: `../packages/application/${packageName}/package.json`,
      transform: (file) => {
        const pkg = JSON.parse(file);
        pkg.dependencies = pkg.dependencies || {};
        const dep = `@application/${portApplicationPackage}`;
        if (!pkg.dependencies[dep]) {
          pkg.dependencies[dep] = "workspace:*";
        }
        return `${JSON.stringify(pkg, null, 2)}\n`;
      },
    });
  }

  return actions;
}

module.exports = {
  parseDependenciesInterface,
  insertAfterLastImport,
  listPortsForApplication,
  applicationSliceFilePath,
  sliceDepsInterfaceName,
  portChoicesNotYetInSliceDeps,
  validatePortPropertyName,
  defaultPortPropertyName,
  buildAddPortDependencyToSliceActions,
};
