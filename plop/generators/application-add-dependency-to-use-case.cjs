const fs = require("fs");
const path = require("path");
const {
  getRepoRoot,
  toKebabCase,
  toCamelCase,
  toPascalCase,
  getApplicationPackageChoices,
  getApplicationUseCaseChoices,
  applicationPortsDir,
} = require("../lib");

const repoRoot = getRepoRoot();

/**
 * Extract `export interface X { ... }` where `X` matches `interfaceName`.
 * Returns the interface body and extracted property identifiers/types.
 * @param {string} source
 * @param {string} interfaceName
 */
function parseDependenciesInterface(source, interfaceName) {
  const decl = `export interface ${interfaceName}`;
  const start = source.indexOf(decl);
  if (start === -1) {
    throw new Error(`Could not find deps interface "${interfaceName}" in file.`);
  }
  const braceStart = source.indexOf("{", start);
  if (braceStart === -1) {
    throw new Error(`Could not find opening "{" for interface "${interfaceName}".`);
  }

  let depth = 1;
  let i = braceStart + 1;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) break;
  }
  if (depth !== 0 || i >= source.length) {
    throw new Error(`Could not find closing "}" for interface "${interfaceName}".`);
  }

  const closeIdx = i;
  const body = source.slice(braceStart + 1, closeIdx);

  const properties = [];
  const propRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*;?/gm;
  let m;
  while ((m = propRe.exec(body)) !== null) {
    properties.push({ name: m[1], type: m[2] });
  }

  let indent = "  ";
  const indentMatch = body.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/m);
  if (indentMatch) {
    const line = indentMatch[0];
    const leading = line.match(/^\s+/)?.[0];
    if (leading) indent = leading;
  }

  return { body, closeIdx, properties, indent };
}

function insertAfterLastImport(src, importLine) {
  const lines = src.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s+/.test(lines[i])) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, importLine, "");
  } else {
    lines.unshift(importLine, "");
  }
  return lines.join("\n");
}

function extractPortInterfaceName(portSource) {
  const m = portSource.match(/export\s+interface\s+([A-Za-z0-9_]+)/);
  if (!m) {
    throw new Error("Could not extract `export interface <Name>` from port file.");
  }
  return m[1];
}

/**
 * Compute default port dependency property name from port filename.
 * Example: `ticket-editor.interaction.port.ts` -> `ticketEditorInteraction`
 * Example: `ticket-support.repository.port.ts` -> `ticketSupportRepository`
 * @param {string} portFileName e.g. `ticket.repository.port.ts`
 */
function computeDefaultPortPropertyName(portFileName) {
  const base = String(portFileName).replace(/\.ts$/, ""); // e.g. ticket-support.repository.port
  const withoutPortSuffix = base.replace(/\.port$/, ""); // e.g. ticket-support.repository OR ticket-editor.interaction
  const normalized = withoutPortSuffix.replace(/\./g, "-"); // ticket-support-repository
  return toCamelCase(normalized);
}

/**
 * @param {string} applicationPackage
 * @returns {{ portFileName: string, interfaceName: string, kind: string, defaultPropertyName: string }[]}
 */
function listPortsForApplication(applicationPackage) {
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

module.exports = function registerApplicationAddDependencyToUseCaseGenerator(plop) {
  plop.setGenerator("application-add-dependency-to-use-case", {
    description: "Add a port dependency to an existing use-case deps interface (required field)",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package (use-case lives here):",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "useCaseName",
        message: "Select use-case:",
        choices: (answers) => getApplicationUseCaseChoices(repoRoot, answers.packageName),
      },
      {
        type: "list",
        name: "portApplicationPackage",
        message: "Select application package that owns the port:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "portFileName",
        message: "Select port to inject:",
        choices: (answers) => {
          const useCasePascal = toPascalCase(answers.useCaseName);
          const depsInterfaceName = `${useCasePascal}UseCaseDependencies`;
          const useCaseKebab = toKebabCase(answers.useCaseName);
          const useCasePath = path.join(
            repoRoot,
            "packages",
            "application",
            answers.packageName,
            "src",
            "use-cases",
            `${useCaseKebab}.use-case.ts`
          );

          if (!fs.existsSync(useCasePath)) {
            throw new Error(`Use-case file not found: ${useCasePath}`);
          }

          const useCaseSource = fs.readFileSync(useCasePath, "utf8");
          const { properties } = parseDependenciesInterface(useCaseSource, depsInterfaceName);
          const existingTypes = new Set(properties.map((p) => p.type));

          const ports = listPortsForApplication(answers.portApplicationPackage);
          if (!ports.length) {
            throw new Error(
              `No port files found in src/ports for application "${answers.portApplicationPackage}".`
            );
          }

          const filtered = ports.filter((p) => !existingTypes.has(p.interfaceName));
          if (!filtered.length) {
            throw new Error("All ports in this package are already present in the use-case deps.");
          }

          return filtered.map((p) => ({
            name: `${p.interfaceName} (${p.portFileName})`,
            value: p.portFileName,
          }));
        },
      },
      {
        type: "input",
        name: "portPropertyName",
        message: "Dependency property name in deps (collision-safe):",
        default: (answers) => {
          const ports = listPortsForApplication(answers.portApplicationPackage);
          const selected = ports.find((p) => p.portFileName === answers.portFileName);
          return selected?.defaultPropertyName ?? "port";
        },
        validate: (value, answers) => {
          const v = String(value || "").trim();
          if (!v) return "Property name cannot be empty";
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(v)) return "Use a valid identifier";

          const useCasePascal = toPascalCase(answers.useCaseName);
          const depsInterfaceName = `${useCasePascal}UseCaseDependencies`;
          const useCaseKebab = toKebabCase(answers.useCaseName);
          const useCasePath = path.join(
            repoRoot,
            "packages",
            "application",
            answers.packageName,
            "src",
            "use-cases",
            `${useCaseKebab}.use-case.ts`
          );

          const useCaseSource = fs.readFileSync(useCasePath, "utf8");
          const { properties } = parseDependenciesInterface(useCaseSource, depsInterfaceName);
          const existingNames = new Set(properties.map((p) => p.name));
          if (existingNames.has(v)) return "Collision: pick another property name.";

          return true;
        },
        filter: (value) => String(value || "").trim(),
      },
    ],
    actions: (data) => {
      const { packageName, useCaseName, portApplicationPackage, portFileName, portPropertyName } =
        data;
      const useCasePascal = toPascalCase(useCaseName);
      const depsInterfaceName = `${useCasePascal}UseCaseDependencies`;
      const useCaseKebab = toKebabCase(useCaseName);
      const useCasePath = path.join(
        repoRoot,
        "packages",
        "application",
        packageName,
        "src",
        "use-cases",
        `${useCaseKebab}.use-case.ts`
      );

      if (!fs.existsSync(useCasePath)) {
        throw new Error(`Use-case file not found: ${useCasePath}`);
      }

      const ports = listPortsForApplication(portApplicationPackage);
      const selectedPort = ports.find((p) => p.portFileName === portFileName);
      if (!selectedPort) {
        throw new Error("Selected port not found (unexpected).");
      }

      const portInterfaceName = selectedPort.interfaceName;
      const importLine = `import type { ${portInterfaceName} } from "@application/${portApplicationPackage}/ports";`;

      const portPropLine = `  ${portPropertyName}: ${portInterfaceName};`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "modify",
        path: `../packages/application/${packageName}/src/use-cases/${useCaseKebab}.use-case.ts`,
        transform: (file) => {
          let updated = file;

          if (!updated.includes(importLine)) {
            updated = insertAfterLastImport(updated, importLine);
          }

          // Add the required dependency field into the deps interface.
          const { closeIdx, properties, indent } = parseDependenciesInterface(
            updated,
            depsInterfaceName
          );
          const existingTypes = new Set(properties.map((p) => p.type));
          if (existingTypes.has(portInterfaceName)) {
            return updated;
          }

          const propertyLine = indent
            ? `${indent}${portPropertyName}: ${portInterfaceName};`
            : portPropLine;

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
    },
  });
};
