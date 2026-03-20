const fs = require("fs");
const path = require("path");
const { getRepoRoot, toPascalCase, lowerFirst } = require("../lib");

const repoRoot = getRepoRoot();

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

function getFeatureChoices(compositionPackage) {
  const srcDir = path.join(repoRoot, "packages", "composition", compositionPackage, "src");
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Composition package "${compositionPackage}" has no src folder.`);
  }

  const features = fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(srcDir, entry.name, "dependencies.ts")))
    .map((entry) => ({ name: entry.name, value: entry.name }));

  if (!features.length) {
    throw new Error(
      `Composition package "${compositionPackage}" has no features with dependencies.ts. Create one first with "composition-feature-dependencies".`
    );
  }

  return features;
}

function getApplicationPackageChoices() {
  const appRoot = path.join(repoRoot, "packages", "application");
  if (!fs.existsSync(appRoot)) {
    return [];
  }

  return fs
    .readdirSync(appRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "core")
    .map((entry) => ({ name: entry.name, value: entry.name }));
}

function getFlowChoices(applicationPackage) {
  const flowsDir = path.join(
    repoRoot,
    "packages",
    "application",
    applicationPackage,
    "src",
    "flows"
  );

  if (!fs.existsSync(flowsDir)) {
    throw new Error(`Application package "${applicationPackage}" has no flows folder.`);
  }

  const flows = fs
    .readdirSync(flowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".flow.ts"))
    .map((entry) => {
      const base = entry.name.replace(/\.flow\.ts$/, "");
      const pascal = toPascalCase(base);
      return {
        name: `${pascal}Flow (${entry.name})`,
        value: pascal,
      };
    });

  if (!flows.length) {
    throw new Error(`Application package "${applicationPackage}" has no flows.`);
  }

  return flows;
}

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionWireFlowGenerator(plop) {
  plop.setGenerator("composition-wire-flow", {
    description:
      "Wire an application flow into an existing composition feature dependencies factory",
    prompts: [
      {
        type: "list",
        name: "compositionPackage",
        message: "Select composition package:",
        choices: getCompositionPackageChoices(),
      },
      {
        type: "list",
        name: "featureName",
        message: "Select feature in composition package:",
        choices: (answers) => getFeatureChoices(answers.compositionPackage),
      },
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package:",
        choices: getApplicationPackageChoices(),
      },
      {
        type: "list",
        name: "flowName",
        message: "Select flow:",
        choices: (answers) => getFlowChoices(answers.applicationPackage),
      },
    ],
    actions: (data) => {
      const { compositionPackage, featureName, applicationPackage, flowName } = data;
      const flowClassName = `${flowName}Flow`;
      const flowVarName = `${lowerFirst(flowName)}Flow`;
      const importLine = `import { ${flowClassName} } from '@application/${applicationPackage}/flows';`;
      const featureDepsPath = `../packages/composition/${compositionPackage}/src/${featureName}/dependencies.ts`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      actions.push({
        type: "modify",
        path: featureDepsPath,
        transform: (file) => {
          let updated = file;

          if (!updated.includes(importLine)) {
            updated = `${importLine}\n${updated}`;
          }

          // Remove placeholder TODO once at least one dependency is wired
          updated = updated.replace(
            /^\s*\/\/ TODO add dependencies \(i\.e\. use-cases and flows\)\s*\n?/m,
            ""
          );

          const returnStart = updated.indexOf("return {");
          if (returnStart === -1) {
            throw new Error(
              `Could not find "return {" in ${featureDepsPath}. Expected a composition feature factory format.`
            );
          }

          const closing = updated.indexOf("}", returnStart);
          if (closing === -1) {
            throw new Error(`Could not find closing "}" of return object in ${featureDepsPath}.`);
          }

          const propertyLine = `    ${flowVarName}: () => new ${flowClassName}({}),`;
          const returnBody = updated.slice(returnStart, closing);

          if (!returnBody.includes(`${flowVarName}:`)) {
            updated = `${updated.slice(0, closing)}${propertyLine}\n${updated.slice(closing)}`;
          }

          return updated;
        },
      });

      actions.push({
        type: "modify",
        path: `../packages/composition/${compositionPackage}/package.json`,
        transform: (file) => {
          const pkg = JSON.parse(file);
          const appDepName = `@application/${applicationPackage}`;

          pkg.dependencies = pkg.dependencies || {};
          if (!pkg.dependencies[appDepName]) {
            pkg.dependencies[appDepName] = "workspace:*";
          }

          return `${JSON.stringify(pkg, null, 2)}\n`;
        },
      });

      return actions;
    },
  });
};
