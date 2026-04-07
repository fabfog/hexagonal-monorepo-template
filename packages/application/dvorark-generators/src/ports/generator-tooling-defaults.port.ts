/**
 * Resolves dev-tool versions for generated `package.json` files from the target workspace (or policy).
 */
export interface GeneratorToolingDefaultsPort {
  /** Semver range for `vitest` in generated packages (workspace scan + fallback, Plop-aligned). */
  vitestRange(workspaceRoot: string): Promise<string>;
  /** Semver range for `zod` when patching domain `package.json` (workspace scan + fallback, Plop-aligned). */
  zodRange(workspaceRoot: string): Promise<string>;
}
