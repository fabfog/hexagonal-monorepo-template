export const ALL_LAYERS = ["Domain", "Application", "Infrastructure", "Composition", "UI"] as const;
export type PlopLayer = (typeof ALL_LAYERS)[number];
export function normalizeLayerChoice(value: string): PlopLayer[] {
  const v = String(value || "").trim();
  if (!v) {
    throw new Error("PLOP_LAYER / --plop-layer value is empty.");
  }
  if (v === "All") {
    return [...ALL_LAYERS];
  }
  const found = ALL_LAYERS.find((l: PlopLayer) => l === v);
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
 */
export function resolveIncludedLayers(
  options: {
    env?: NodeJS.ProcessEnv;
    argv?: string[];
  } = {}
): PlopLayer[] | null {
  const env = options.env ?? process.env;
  const argv = options.argv ?? process.argv;
  const fromEnv = env.PLOP_LAYER?.trim();
  if (fromEnv) {
    return normalizeLayerChoice(fromEnv);
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    const next = argv[i + 1];
    if (arg === "--plop-layer" && next !== undefined) {
      return normalizeLayerChoice(next);
    }
    const eq = arg.match(/^--plop-layer=(.+)$/);
    const v = eq?.[1];
    if (v !== undefined) {
      return normalizeLayerChoice(v);
    }
  }
  return null;
}
