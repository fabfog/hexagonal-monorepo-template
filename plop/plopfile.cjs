const { ALL_LAYERS, resolveIncludedLayers } = require("./plop-resolve-layers.cjs");
const { registerGeneratorsForLayers } = require("./plop-register-generators.cjs");
const { getRepoRoot, resolveWorkspaceDependencyVersion } = require("./lib");

/** @param {import('plop').NodePlopAPI} plop */
module.exports = async function (plop) {
  const repoRoot = getRepoRoot();
  plop.setHelper("workspaceDependencyVersion", (depName) => {
    const resolved = resolveWorkspaceDependencyVersion(repoRoot, String(depName));
    if (!resolved) {
      throw new Error(`Could not resolve a workspace version for dependency "${depName}"`);
    }
    return resolved;
  });

  let includedLayers = resolveIncludedLayers();

  if (!includedLayers) {
    const { layer } = await plop.inquirer.prompt([
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
};
