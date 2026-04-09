import type { NodePlopAPI } from "node-plop";
import type { Answers } from "inquirer";
import {
  getRepoRoot,
  getApplicationPackageChoices,
  getApplicationUseCaseChoices,
  portChoicesNotYetInSliceDeps,
  validatePortPropertyName,
  defaultPortPropertyName,
  buildAddPortDependencyToSliceActions,
} from "../lib/index.ts";
const repoRoot = getRepoRoot();
export default function registerApplicationAddDependencyToUseCaseGenerator(plop: NodePlopAPI) {
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
        choices: (answers: Answers) => getApplicationUseCaseChoices(repoRoot, answers.packageName),
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
        choices: (answers: Answers) =>
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
        default: (answers: Answers) =>
          defaultPortPropertyName(repoRoot, answers.portApplicationPackage, answers.portFileName),
        validate: (value: unknown, answers: Answers) =>
          validatePortPropertyName(value, answers, repoRoot, "use-case", answers.useCaseName),
        filter: (value: unknown) => String(value || "").trim(),
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
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
}
