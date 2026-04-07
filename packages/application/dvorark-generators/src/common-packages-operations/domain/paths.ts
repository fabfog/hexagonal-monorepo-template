const DOMAIN_ROOT = "packages/domain";

/**
 * Relative path from workspace root to `packages/domain/<slug>/`.
 */
export function domainPackageRootRelative(domainPackageSlug: string): string {
  return `${DOMAIN_ROOT}/${domainPackageSlug}`;
}

export function domainPackageJsonRelativePath(domainPackageSlug: string): string {
  return `${domainPackageRootRelative(domainPackageSlug)}/package.json`;
}

export type DomainPackageSlice = "entities" | "value-objects" | "errors";

export function domainSliceIndexRelativePath(
  domainPackageSlug: string,
  slice: DomainPackageSlice
): string {
  return `${domainPackageRootRelative(domainPackageSlug)}/src/${slice}/index.ts`;
}
