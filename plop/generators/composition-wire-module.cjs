const fs = require("fs");
const path = require("path");
const {
  getRepoRoot,
  getCompositionPackageChoices,
  getApplicationPackagesWithModulesChoices,
  getApplicationModuleFileChoices,
  assertCompositionEntryIndexExists,
  getCompositionEntryIndexPath,
} = require("../lib");
const {
  wireApplicationModuleIntoCompositionIndex,
  ensureCompositionDependsOnApplication,
  defaultPropertyKeyFromModuleFile,
} = require("../lib/composition-wire-module.cjs");

const repoRoot = getRepoRoot();

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function registerCompositionWireModuleGenerator(plop) {
  plop.setGenerator("composition-wire-module", {
    description:
      "Wire an @application/*/modules class into a composition package get*Modules return (import + package.json dependency; Infra typing stays manual)",
    prompts: [
      {
        type: "list",
        name: "compositionPackage",
        message: "Composition package:",
        choices: () => {
          const c = getCompositionPackageChoices(repoRoot);
          if (!c.length) {
            throw new Error(
              'No packages under packages/composition. Run "composition-package" first.'
            );
          }
          return c;
        },
      },
      {
        type: "list",
        name: "applicationPackage",
        message: "Application package (with at least one *.module.ts):",
        choices: () => {
          const c = getApplicationPackagesWithModulesChoices(repoRoot);
          if (!c.length) {
            throw new Error(
              'No application packages with src/modules/*.module.ts. Run "application-module" first.'
            );
          }
          return c;
        },
      },
      {
        type: "list",
        name: "moduleFileName",
        message: "Module file:",
        choices: (answers) => getApplicationModuleFileChoices(repoRoot, answers.applicationPackage),
      },
      {
        type: "input",
        name: "propertyKey",
        message: "Property key in the return object (camelCase):",
        default: (answers) => defaultPropertyKeyFromModuleFile(answers.moduleFileName),
        validate: (value) => {
          const v = String(value || "").trim();
          if (!v) return "Property key is required";
          if (!/^[a-z][a-zA-Z0-9]*$/.test(v)) return "Use a valid camelCase identifier";
          return true;
        },
      },
    ],
    actions: [
      (data) => {
        assertCompositionEntryIndexExists(repoRoot, data.compositionPackage);
        const indexPath = getCompositionEntryIndexPath(repoRoot, data.compositionPackage);
        const pkgJsonPath = path.join(
          repoRoot,
          "packages",
          "composition",
          data.compositionPackage,
          "package.json"
        );
        ensureCompositionDependsOnApplication(pkgJsonPath, data.applicationPackage);
        const next = wireApplicationModuleIntoCompositionIndex(indexPath, {
          applicationPackageKebab: data.applicationPackage,
          moduleFileName: data.moduleFileName,
          propertyKey: String(data.propertyKey).trim(),
        });
        fs.writeFileSync(indexPath, next, "utf8");
        return `Wired ${data.moduleFileName} → @composition/${data.compositionPackage} (${path.relative(repoRoot, indexPath)})`;
      },
    ],
  });
};
