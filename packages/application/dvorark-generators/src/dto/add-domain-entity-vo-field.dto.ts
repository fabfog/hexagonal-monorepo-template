import type { DomainEntityVoFieldSource } from "../common-packages-operations/domain";

export interface AddDomainEntityVoFieldInputDto {
  workspaceRoot: string;
  domainPackageSlugInput: string;
  /**
   * PascalCase entity stem (e.g. `LineItem`), matching `*.entity.ts` file stem via kebab-case
   * (same as Plop `getDomainEntityChoices` values).
   */
  entityPascalInput: string;
  /** camelCase property name (e.g. `email`, `homePage`). */
  propertyNameInput: string;
  voClass: string;
  voSource: DomainEntityVoFieldSource;
}
