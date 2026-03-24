const {
  getRepoRoot,
  lowerFirst,
  getCompositionPackageChoices,
  getCompositionFeatureChoices,
  getApplicationPackageChoices,
  getApplicationUseCaseChoices,
  getRuntimesForFeature,
} = require("../lib");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionWireUseCaseGenerator(plop) {
  plop.setGenerator("composition-wire-use-case", {
    description:
      "Wire an application use-case into an existing composition feature dependencies factory",
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
        type: "checkbox",
        name: "runtimes",
        message: "Runtime(s) to add this use case to:",
        choices: (answers) => {
          const runtimes = getRuntimesForFeature(
            repoRoot,
            answers.compositionPackage,
            answers.featureName
          );
          if (!runtimes.length) return [];
          return runtimes.map((r) => ({ name: r, value: r }));
        },
        validate: (value) =>
          Array.isArray(value) && value.length > 0 ? true : "Select at least one runtime",
      },
      {
        type: "list",
        name: "applicationPackage",
        message: "Select application package:",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "useCaseName",
        message: "Select use-case:",
        choices: (answers) => getApplicationUseCaseChoices(repoRoot, answers.applicationPackage),
      },
    ],
    actions: (data) => {
      const { compositionPackage, featureName, runtimes, applicationPackage, useCaseName } = data;
      const useCaseClassName = `${useCaseName}UseCase`;
      const useCaseVarName = `${lowerFirst(useCaseName)}UseCase`;
      const importLine = `import { ${useCaseClassName} } from '@application/${applicationPackage}/use-cases';`;

      /** @type {import('plop').ActionType[]} */
      const actions = [];

      for (const runtime of runtimes) {
        const depsDir = `src/${runtime}`;
        const featureDepsPath = `../packages/composition/${compositionPackage}/${depsDir}/${featureName}/dependencies.ts`;

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

            const propertyLine = `    ${useCaseVarName}: () => new ${useCaseClassName}({}),`;
            const returnBody = updated.slice(returnStart, closing);

            if (!returnBody.includes(`${useCaseVarName}:`)) {
              updated = `${updated.slice(0, closing)}${propertyLine}\n${updated.slice(closing)}`;
            }

            return updated;
          },
        });
      }

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
