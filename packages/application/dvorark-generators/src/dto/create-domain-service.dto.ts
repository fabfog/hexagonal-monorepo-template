/**
 * Driving input for {@link CreateDomainServiceUseCase} (strings from CLI / IPC).
 */
export interface CreateDomainServiceInputDto {
  /** Absolute path to the monorepo root where `packages/domain/<domainPackage>` exists. */
  workspaceRoot: string;
  /** Existing domain package segment under `packages/domain/` (Plop excludes `core` by default). */
  domainPackageSlugInput: string;
  /**
   * Base name without the `Service` suffix (e.g. `UserDiscountEligibility`).
   * A trailing `Service` is stripped like Plop.
   */
  serviceNameInput: string;
  /**
   * Entity stems in PascalCase (e.g. `User`, `LineItem`) — template imports `UserEntity`, etc.
   * At least one, matching Plop checkbox selection.
   */
  selectedEntityPascalNames: string[];
}
