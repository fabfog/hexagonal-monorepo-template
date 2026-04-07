/**
 * Driving input for {@link CreateDomainEntityUseCase} (strings from CLI / IPC).
 */
export interface CreateDomainEntityInputDto {
  /** Absolute path to the monorepo root where `packages/domain/<domainPackage>` exists. */
  workspaceRoot: string;
  /** Existing domain package segment under `packages/domain/` (e.g. `user`, `order-line`). */
  domainPackageSlugInput: string;
  /** Entity name; normalized via `EntitySlug.fromString` in the use case. */
  entitySlugInput: string;
}
