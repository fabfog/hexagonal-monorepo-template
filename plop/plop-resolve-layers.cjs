/** @typedef {"Domain"|"Application"|"Infrastructure"|"Composition"|"UI"} PlopLayer */

const ALL_LAYERS = /** @type {const} */ ([
  "Domain",
  "Application",
  "Infrastructure",
  "Composition",
  "UI",
]);

/**
 * @param {string} value
 * @returns {PlopLayer[]}
 */
function normalizeLayerChoice(value) {
  const v = String(value || "").trim();
  if (!v) {
    throw new Error("PLOP_LAYER / --plop-layer value is empty.");
  }
  if (v === "All") {
    return [...ALL_LAYERS];
  }
  const found = ALL_LAYERS.find((l) => l === v);
  if (!found) {
    throw new Error(
      `Invalid PLOP_LAYER / --plop-layer: "${value}". Use All or one of: ${ALL_LAYERS.join(", ")}.`
    );
  }
  return [found];
}

/**
 * When non-interactive layer is configured, returns included layers; otherwise `null` (show prompt).
 *
 * Resolution order: `options.env.PLOP_LAYER`, then `options.argv` flags:
 * `--plop-layer=All` or `--plop-layer All`.
 *
 * @param {{ env?: NodeJS.ProcessEnv, argv?: string[] }} [options]
 * @returns {PlopLayer[] | null}
 */
function resolveIncludedLayers(options = {}) {
  const env = options.env ?? process.env;
  const argv = options.argv ?? process.argv;

  const fromEnv = env.PLOP_LAYER?.trim();
  if (fromEnv) {
    return normalizeLayerChoice(fromEnv);
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--plop-layer" && argv[i + 1]) {
      return normalizeLayerChoice(argv[i + 1]);
    }
    const eq = arg.match(/^--plop-layer=(.+)$/);
    if (eq) {
      return normalizeLayerChoice(eq[1]);
    }
  }

  return null;
}

module.exports = {
  ALL_LAYERS,
  resolveIncludedLayers,
  normalizeLayerChoice,
};
