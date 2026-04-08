/**
 * Driving input for {@link CreateUiPackageUseCase} (strings from CLI / IPC).
 */
export interface CreateUiPackageInputDto {
  /** Absolute path to the monorepo root where `packages/ui` lives. */
  workspaceRoot: string;
  /** User-typed name; normalized via {@link UiPackageSlug.fromString}. */
  packageSlugInput: string;
  /** Optional override for the `vitest` range in generated `package.json`; otherwise resolved via `GeneratorToolingDefaultsPort`. */
  vitestVersionOverride?: string;
}
