const APPLICATION_ROOT = "packages/application";

/**
 * Relative path from workspace root to `packages/application/<slug>/`.
 */
export function applicationPackageRootRelative(applicationPackageSlug: string): string {
  return `${APPLICATION_ROOT}/${applicationPackageSlug}`;
}

export function applicationPackageJsonRelativePath(applicationPackageSlug: string): string {
  return `${applicationPackageRootRelative(applicationPackageSlug)}/package.json`;
}
