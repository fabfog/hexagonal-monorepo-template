/**
 * dependency-cruiser config for **package-level graphs** only (`pnpm deps:graph`).
 * Enables TypeScript pre-compilation dependencies so `import type` from `@domain/...`
 * appears as edges (the default lint config omits them for runtime-focused rules).
 */
const base = require("./.dependency-cruiser.cjs");

module.exports = {
  ...base,
  options: {
    ...base.options,
    tsPreCompilationDeps: true,
  },
};
