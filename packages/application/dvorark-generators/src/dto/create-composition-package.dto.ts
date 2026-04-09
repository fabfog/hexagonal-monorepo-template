/**
 * Driving input for {@link CreateCompositionPackageUseCase} (strings from CLI / IPC).
 */
export interface CreateCompositionPackageInputDto {
  /** Absolute path to the monorepo root where `packages/composition` lives. */
  workspaceRoot: string;
  /** User-typed name; normalized to a kebab-case composition package slug. */
  packageSlugInput: string;
}
