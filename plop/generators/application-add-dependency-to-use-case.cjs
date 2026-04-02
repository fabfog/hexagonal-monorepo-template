const {
  getRepoRoot,
  getApplicationPackageChoices,
  getApplicationUseCaseChoices,
  portChoicesNotYetInSliceDeps,
  validatePortPropertyName,
  defaultPortPropertyName,
  buildAddPortDependencyToSliceActions,
} = require("../lib");

const repoRoot = getRepoRoot();

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
        choices: (answers) =>
          portChoicesNotYetInSliceDeps(repoRoot, {
            packageName: answers.packageName,
            sliceKind: "use-case",
            sliceName: answers.useCaseName,
            portApplicationPackage: answers.portApplicationPackage,
            sliceFileLabel: "Use-case",
            allPortsPresentMessage:
              "All ports in this package are already present in the use-case deps.",
          }),
      },
      {
        type: "input",
        name: "portPropertyName",
        message: "Dependency property name in deps (collision-safe):",
        default: (answers) =>
          defaultPortPropertyName(repoRoot, answers.portApplicationPackage, answers.portFileName),
        validate: (value, answers) =>
          validatePortPropertyName(value, answers, repoRoot, "use-case", answers.useCaseName),
        filter: (value) => String(value || "").trim(),
      },
    ],
    actions: (data) => {
      const { packageName, useCaseName, portApplicationPackage, portFileName, portPropertyName } =
        data;

      return buildAddPortDependencyToSliceActions(repoRoot, {
        packageName,
        sliceKind: "use-case",
        sliceName: useCaseName,
        portApplicationPackage,
        portFileName,
        portPropertyName,
      });
    },
  });
};
