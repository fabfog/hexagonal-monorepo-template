/**
 * Resolves dev-tool versions for generated `package.json` files from the target workspace (or policy).
 */
export interface GeneratorToolingDefaultsPort {
  /** Semver range for `vitest` in generated packages (e.g. aligned with workspace root). */
  vitestRange(workspaceRoot: string): Promise<string>;
}
