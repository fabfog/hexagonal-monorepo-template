const {
  getRepoRoot,
  lowerFirst,
  getCompositionPackageChoices,
  getCompositionFeatureChoices,
  getApplicationPackageChoices,
  getApplicationFlowChoices,
} = require("../lib");

const repoRoot = getRepoRoot();

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
        choices: getCompositionPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "featureName",
        message: "Select feature in composition package:",
        choices: (answers) => getCompositionFeatureChoices(repoRoot, answers.compositionPackage),
      },
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "flowName",
        message: "Select flow:",
        choices: (answers) => getApplicationFlowChoices(repoRoot, answers.applicationPackage),
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
