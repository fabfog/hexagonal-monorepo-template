export { EMPTY_BARREL_EXPORT_PATTERN } from "./constants";
export { mergeBarrelExport } from "./merge-barrel-export";
export {
  applyConditionalExportsToPackageJson,
  applyDomainCoreDependencyToPackageJson,
  applyZodDevDependencyToPackageJson,
  patchPackageJsonEnsureZodDependency,
  patchPackageJsonExports,
  patchPackageJsonWithZodAndExports,
  patchPackageJsonZodAndOptionalDomainCore,
  type PatchPackageJsonExportsOptions,
  type PatchPackageJsonWithZodAndExportsOptions,
  type PatchPackageJsonZodAndOptionalDomainCoreOptions,
} from "./patch-package-json";
