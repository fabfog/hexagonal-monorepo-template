import type { NodePlopAPI } from "node-plop";
import inquirer from "inquirer";
import { ALL_LAYERS, resolveIncludedLayers } from "./plop-resolve-layers.ts";
import { registerGeneratorsForLayers } from "./plop-register-generators.ts";
import { getRepoRoot, resolveWorkspaceDependencyVersion } from "./lib/index.ts";
export default async function (plop: NodePlopAPI) {
  const repoRoot = getRepoRoot();
  plop.setHelper("workspaceDependencyVersion", (depName: unknown) => {
    const resolved = resolveWorkspaceDependencyVersion(repoRoot, String(depName));
    if (!resolved) {
      throw new Error(`Could not resolve a workspace version for dependency "${depName}"`);
    }
    return resolved;
  });
  let includedLayers = resolveIncludedLayers();
  if (!includedLayers) {
    const { layer } = await inquirer.prompt([
      {
        type: "list",
        name: "layer",
        message: "Select generators for layer...",
        choices: [...ALL_LAYERS, "All"],
        pageSize: 10,
      },
    ]);
    includedLayers = layer === "All" ? [...ALL_LAYERS] : [layer];
  }
  registerGeneratorsForLayers(plop, includedLayers);
}
