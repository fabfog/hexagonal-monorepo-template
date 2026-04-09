import type { NodePlopAPI } from "node-plop";
import type { Answers } from "inquirer";
import {
  getRepoRoot,
  getApplicationPackageChoices,
  getApplicationFlowChoices,
  portChoicesNotYetInSliceDeps,
  validatePortPropertyName,
  defaultPortPropertyName,
  buildAddPortDependencyToSliceActions,
} from "../lib/index.ts";
const repoRoot = getRepoRoot();
export default function registerApplicationAddDependencyToFlowGenerator(plop: NodePlopAPI) {
  plop.setGenerator("application-add-dependency-to-flow", {
    description: "Add a port dependency to an existing flow deps interface (required field)",
    prompts: [
      {
        type: "list",
        name: "packageName",
        message: "Select application package (flow lives here):",
        choices: getApplicationPackageChoices(repoRoot),
      },
      {
        type: "list",
        name: "flowName",
        message: "Select flow:",
        choices: (answers: Answers) => getApplicationFlowChoices(repoRoot, answers.packageName),
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
            sliceKind: "flow",
            sliceName: answers.flowName,
            portApplicationPackage: answers.portApplicationPackage,
            sliceFileLabel: "Flow",
            allPortsPresentMessage:
              "All ports in this package are already present in the flow deps.",
          }),
      },
      {
        type: "input",
        name: "portPropertyName",
        message: "Dependency property name in deps (collision-safe):",
        default: (answers: Answers) =>
          defaultPortPropertyName(repoRoot, answers.portApplicationPackage, answers.portFileName),
        validate: (value: unknown, answers: Answers) =>
          validatePortPropertyName(value, answers, repoRoot, "flow", answers.flowName),
        filter: (value: unknown) => String(value || "").trim(),
      },
    ],
    actions: (data?: Answers) => {
      if (!data) return [];
      const { packageName, flowName, portApplicationPackage, portFileName, portPropertyName } =
        data;
      return buildAddPortDependencyToSliceActions(repoRoot, {
        packageName,
        sliceKind: "flow",
        sliceName: flowName,
        portApplicationPackage,
        portFileName,
        portPropertyName,
      });
    },
  });
}
