/** Default `zod` devDependency range when patching a package.json for generated code. */
export const DEFAULT_ZOD_DEV_RANGE = "^3.23.8";

/** Matches a placeholder barrel line like `export {};` that generators strip before appending. */
export const EMPTY_BARREL_EXPORT_PATTERN = /^export\s*{\s*}\s*;?\s*$/m;
