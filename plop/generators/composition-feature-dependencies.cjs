const fs = require("fs");
const path = require("path");

function toKebabCase(value) {
  return String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function toPascalCase(value) {
  return String(value)
    .trim()
    .split(/[\s\-_/]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

const repoRoot = path.join(__dirname, "..", "..");

function getCompositionPackageChoices() {
  const compositionRoot = path.join(repoRoot, "packages", "composition");
  if (!fs.existsSync(compositionRoot)) {
    return [];
  }

  return fs
    .readdirSync(compositionRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, value: entry.name }));
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionFeatureDependenciesGenerator(plop) {
  plop.setGenerator("composition-feature-dependencies", {
    description:
      "Add a feature dependency factory and register it (lazy) in the composition package index",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select composition package:",
        choices: getCompositionPackageChoices(),
      },
      {
        type: "input",
        name: "featureName",
        message: "Feature name (e.g. DocumentEditor, UserProfile):",
      },
    ],
    actions: (data) => {
      const { packageName, featureName } = data;
      const kebab = toKebabCase(featureName);
      const camel = toCamelCase(featureName);
      const pascal = toPascalCase(featureName);

      const importPath = `./${kebab}/dependencies`;
      const importLine = `import { create${pascal}Dependencies } from '${importPath}';`;
      const cacheVarName = `_${camel}`;
      const cacheLine = `let ${cacheVarName}: ReturnType<typeof create${pascal}Dependencies> | undefined;`;
      const getterBlock = `  get ${camel}() {
    if (${cacheVarName} === undefined) {
      ${cacheVarName} = create${pascal}Dependencies();
    }
    return ${cacheVarName};
  }`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "add",
        path: "../packages/composition/{{packageName}}/src/{{kebabCase featureName}}/dependencies.ts",
        templateFile: "templates/composition-feature-dependencies/dependencies.ts.hbs",
      });

      actions.push({
        type: "modify",
        path: "../packages/composition/{{packageName}}/src/index.ts",
        transform: (file) => {
          const trimmed = file.replace(/^export\s*{\s*}\s*;?\s*$/m, "").trimEnd();
          const hasDependencies = trimmed.includes("export const dependencies");

          if (!hasDependencies && trimmed.length <= 20) {
            return `${importLine}

${cacheLine}

export const dependencies = {
${getterBlock},
};
`;
          }

          if (!hasDependencies) {
            return `${trimmed}

${importLine}

${cacheLine}

export const dependencies = {
${getterBlock},
};
`;
          }

          const lines = trimmed.split("\n");
          let lastImportIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (/^\s*import\s+.+\s*;\s*$/.test(lines[i])) lastImportIdx = i;
          }

          const out = [...lines];

          if (lastImportIdx >= 0) {
            out.splice(lastImportIdx + 1, 0, importLine);
          } else {
            out.unshift(importLine, "");
          }

          let lastCacheIdx = -1;
          for (let i = 0; i < out.length; i++) {
            if (/^\s*let _\w+:\s*ReturnType/.test(out[i])) lastCacheIdx = i;
          }
          const dependenciesLineIdx = out.findIndex((l) => l.includes("export const dependencies"));
          if (lastCacheIdx >= 0) {
            out.splice(lastCacheIdx + 1, 0, cacheLine);
          } else if (dependenciesLineIdx >= 0) {
            out.splice(dependenciesLineIdx, 0, cacheLine, "");
          }

          const dependenciesStartIdx = out.findIndex((l) =>
            l.includes("export const dependencies")
          );
          if (dependenciesStartIdx < 0) {
            throw new Error("Could not find dependencies object in composition index.ts");
          }

          let braceDepth = 0;
          let closingIdx = -1;
          for (let i = dependenciesStartIdx; i < out.length; i++) {
            const line = out[i];
            const opens = (line.match(/\{/g) || []).length;
            const closes = (line.match(/\}/g) || []).length;
            braceDepth += opens - closes;
            if (braceDepth === 0 && i > dependenciesStartIdx) {
              closingIdx = i;
              break;
            }
          }
          if (closingIdx < 0) {
            throw new Error("Could not determine closing brace for dependencies object");
          }

          const prevLine = out[closingIdx - 1]?.trim() ?? "";
          if (prevLine.endsWith("}") && !prevLine.endsWith(",")) {
            out[closingIdx - 1] = out[closingIdx - 1].replace(/\s*}\s*$/, "},");
          }
          out.splice(closingIdx, 0, getterBlock + ",");
          return out.join("\n");
        },
      });

      return actions;
    },
  });
};
