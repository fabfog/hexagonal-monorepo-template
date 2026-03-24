const {
  getRepoRoot,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  getCompositionPackageChoices,
  COMPOSITION_RUNTIMES,
  ensureCompositionRuntimeFiles,
  mergeCompositionPackageExports,
} = require("../lib");

const repoRoot = getRepoRoot();

/**
 * @param {string} file
 * @param {{ importLine: string, cacheLine: string, getterBlock: string }} blocks
 */
function addFeatureGetterToIndex(file, blocks) {
  const { importLine, cacheLine, getterBlock } = blocks;
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

  const dependenciesStartIdx = out.findIndex((l) => l.includes("export const dependencies"));
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
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionFeatureDependenciesGenerator(plop) {
  plop.setGenerator("composition-feature-dependencies", {
    description:
      "Add a feature dependency factory and register it (lazy) in the composition package entry points",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select composition package:",
        choices: getCompositionPackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "featureName",
        message: "Feature name (e.g. DocumentEditor, UserProfile):",
        validate: (value) => String(value || "").trim().length > 0 || "Name cannot be empty",
      },
      {
        type: "checkbox",
        name: "runtimes",
        message: "Runtime(s) for this feature:",
        choices: COMPOSITION_RUNTIMES.map((r) => ({ name: r, value: r })),
        validate: (value) =>
          Array.isArray(value) && value.length > 0 ? true : "Select at least one runtime",
      },
    ],
    actions: (data) => {
      const { packageName, featureName, runtimes } = data;
      const kebab = toKebabCase(featureName);
      const camel = toCamelCase(featureName);
      const pascal = toPascalCase(featureName);

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
        type: "modify",
        path: `../packages/composition/${packageName}/package.json`,
        transform: (file, data) => {
          const pkg = JSON.parse(file);
          for (const runtime of data.runtimes) {
            ensureCompositionRuntimeFiles(repoRoot, data.packageName, runtime);
          }
          mergeCompositionPackageExports(pkg, data.runtimes);
          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      for (const runtime of runtimes) {
        const depsDir = `src/${runtime}`;
        const addPath = `../packages/composition/${packageName}/${depsDir}/${kebab}/dependencies.ts`;
        const importPath = `./${kebab}/dependencies`;
        const importLine = `import { create${pascal}Dependencies } from '${importPath}';`;

        actions.push({
          type: "add",
          path: addPath,
          templateFile: "templates/composition-feature-dependencies/dependencies.ts.hbs",
        });

        const modifyPath = `../packages/composition/${packageName}/src/${runtime}/index.ts`;

        actions.push({
          type: "modify",
          path: modifyPath,
          transform: (file) =>
            addFeatureGetterToIndex(file, {
              importLine,
              cacheLine,
              getterBlock,
            }),
        });
      }

      return actions;
    },
  });
};
