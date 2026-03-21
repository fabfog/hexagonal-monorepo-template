const {
  getRepoRoot,
  getCompositionPackageChoices,
  getDrivenInfrastructurePackageChoices,
} = require("../lib");

const repoRoot = getRepoRoot();

/**
 * @param {string} src
 * @returns {{ openIdx: number, closeIdx: number } | null}
 */
function findInfrastructureObjectBlock(src) {
  const re = /export\s+const\s+infrastructure\s*=\s*\{/;
  const m = src.match(re);
  if (!m || m.index === undefined) return null;
  const openIdx = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { openIdx, closeIdx: i };
    }
  }
  return null;
}

/**
 * @param {string} src
 * @param {{ infrastructureKey: string, cacheVarName: string, adapterClassName: string }} p
 */
function mergeInfrastructureFile(src, p) {
  const { infrastructureKey, cacheVarName, adapterClassName } = p;
  const getterRe = new RegExp(`get\\s+${infrastructureKey}\\s*\\(`);
  if (getterRe.test(src)) {
    throw new Error(
      `infrastructure.${infrastructureKey} is already wired in this file. Choose another key or remove the existing getter.`
    );
  }

  const importLine = `import { ${adapterClassName} } from '@infrastructure/${p.drivenPackage}';`;
  let updated = src.trim().length ? src : "";

  if (!updated.includes("export const infrastructure")) {
    const letLine = `let ${cacheVarName}: ${adapterClassName} | undefined;`;
    const getterBlock = `  get ${infrastructureKey}() {
    if (${cacheVarName} === undefined) {
      // TODO: pass constructor args (config, env, other ports, etc.)
      ${cacheVarName} = new ${adapterClassName}();
    }
    return ${cacheVarName};
  }`;
    return `${importLine}\n\n${letLine}\n\nexport const infrastructure = {\n${getterBlock},\n};\n`;
  }

  if (!updated.includes(importLine)) {
    const lines = updated.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
    } else {
      lines.unshift(importLine, "");
    }
    updated = lines.join("\n");
  }

  const letLine = `let ${cacheVarName}: ${adapterClassName} | undefined;`;
  if (!updated.includes(letLine)) {
    const infraDecl = updated.indexOf("export const infrastructure");
    if (infraDecl === -1) {
      throw new Error("Could not find export const infrastructure");
    }
    const before = updated.slice(0, infraDecl).trimEnd();
    updated = `${before}\n\n${letLine}\n\n${updated.slice(infraDecl)}`;
  }

  const getterBlock = `  get ${infrastructureKey}() {
    if (${cacheVarName} === undefined) {
      // TODO: pass constructor args (config, env, other ports, etc.)
      ${cacheVarName} = new ${adapterClassName}();
    }
    return ${cacheVarName};
  }`;

  const block = findInfrastructureObjectBlock(updated);
  if (!block) {
    throw new Error("Could not parse infrastructure object block");
  }
  const { openIdx, closeIdx } = block;
  const innerRaw = updated.slice(openIdx + 1, closeIdx);
  const trimmedEnd = innerRaw.trimEnd();
  const needsComma = trimmedEnd.length > 0 && !trimmedEnd.endsWith(",");
  const newInner = `${innerRaw}${needsComma ? "," : ""}\n${getterBlock},\n`;
  updated = updated.slice(0, openIdx + 1) + newInner + updated.slice(closeIdx);

  return updated.endsWith("\n") ? updated : `${updated}\n`;
}

/**
 * @param {string} src
 */
function ensureInfrastructureReExport(src) {
  const line = "export { infrastructure } from './infrastructure';";
  if (src.includes("from './infrastructure'") || src.includes('from "./infrastructure"')) {
    return src;
  }
  const trimmed = src.trimEnd();
  if (!trimmed) return `${line}\n`;
  return `${trimmed}\n\n${line}\n`;
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionWireInfrastructureGenerator(plop) {
  plop.setGenerator("composition-wire-infrastructure", {
    description:
      "Wire a driven-* infrastructure package into composition: lazy getters on src/infrastructure.ts + @infrastructure/* dependency",
    prompts: [
      {
        type: "list",
        name: "compositionPackage",
        message: "Select composition package:",
        choices: getCompositionPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "drivenPackage",
        message: "Select driven infrastructure package (source adapter):",
        choices: getDrivenInfrastructurePackageChoices(repoRoot),
      },
      {
        type: "input",
        name: "infrastructureKey",
        message:
          "Property name on `infrastructure` (camelCase, e.g. cms, contentful, search). Used as infrastructure.cms etc.:",
        validate: (value) => {
          const v = String(value || "").trim();
          if (!v) return "Key cannot be empty";
          if (!/^[a-z][a-zA-Z0-9]*$/.test(v)) {
            return "Use a valid camelCase identifier (start with lowercase letter)";
          }
          return true;
        },
        filter: (value) => String(value || "").trim(),
      },
      {
        type: "input",
        name: "adapterClassName",
        message:
          "Adapter class name exported from the driven package (e.g. ContentfulAdapter, CiaoAdapter):",
        validate: (value) => String(value || "").trim().length > 0 || "Class name cannot be empty",
        filter: (value) => String(value || "").trim(),
      },
    ],
    actions: (data) => {
      const { compositionPackage, drivenPackage, infrastructureKey, adapterClassName } = data;

      const cacheVarName = `_${infrastructureKey}Instance`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "add",
        path: `../packages/composition/${compositionPackage}/src/infrastructure.ts`,
        template: "export const infrastructure = {};\n",
        skipIfExists: true,
      });

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/src/infrastructure.ts`,
        transform: (file) =>
          mergeInfrastructureFile(file, {
            drivenPackage,
            infrastructureKey,
            cacheVarName,
            adapterClassName,
          }),
      });

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/src/index.ts`,
        transform: (file) => ensureInfrastructureReExport(file),
      });

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          const infraDep = `@infrastructure/${drivenPackage}`;

          pkg.dependencies = pkg.dependencies || {};
          if (!pkg.dependencies[infraDep]) {
            pkg.dependencies[infraDep] = "workspace:*";
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      return actions;
    },
  });
};
