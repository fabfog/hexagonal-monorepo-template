import path from "node:path";

import pc from "picocolors";

import { runGenerateDomainEntityAddVoFieldCommand } from "../../../commands/generate-domain-entity-add-vo-field.command";
import { promptSelect, promptText } from "../../prompts";
import { listDomainEntityPascalNames } from "./list-domain-entities";
import { listDomainPackageSlugs } from "./list-domain-packages";
import { listVoFieldChoices } from "./list-domain-vo-field-choices";

export interface DomainEntityAddVoFieldWizardInput {
  workspaceRoot?: string;
  domainPackageSlug?: string;
  entityPascal?: string;
  propertyName?: string;
}

export async function runDomainEntityAddVoFieldWizard(
  partial: DomainEntityAddVoFieldWizardInput = {}
): Promise<void> {
  let workspaceRoot = partial.workspaceRoot;
  if (!workspaceRoot) {
    const workspaceInput = await promptText({
      message: "Monorepo root (contains packages/domain)",
      initialValue: process.cwd(),
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    });
    workspaceRoot = path.resolve(workspaceInput.trim());
  } else {
    workspaceRoot = path.resolve(workspaceRoot);
  }

  let domainPackageSlug = partial.domainPackageSlug?.trim();
  if (!domainPackageSlug) {
    const choices = listDomainPackageSlugs(workspaceRoot, { excludeCore: false });
    if (choices.length === 0) {
      console.error(pc.red("No domain packages under packages/domain."));
      return;
    }
    domainPackageSlug = await promptSelect({
      message: "Domain package under packages/domain",
      options: choices.map((slug) => ({ value: slug, label: slug })),
    });
  }

  let entityPascal = partial.entityPascal?.trim();
  if (!entityPascal) {
    const entityChoices = listDomainEntityPascalNames(workspaceRoot, domainPackageSlug);
    if (entityChoices.length === 0) {
      console.error(
        pc.red(
          `No entities in @domain/${domainPackageSlug}. Create an entity first (e.g. dvorark generate domain-entity).`
        )
      );
      return;
    }
    entityPascal = await promptSelect({
      message: "Entity",
      options: entityChoices.map((name) => ({ value: name, label: name })),
    });
  }

  let propertyName = partial.propertyName?.trim();
  if (!propertyName) {
    propertyName = (
      await promptText({
        message: "Property name (camelCase, e.g. email, homePage)",
        placeholder: "email",
        validate: (v) => {
          const s = String(v || "").trim();
          if (!s) {
            return "Required";
          }
          if (!/^[a-z][a-zA-Z0-9]*$/.test(s)) {
            return "Use camelCase starting with a lowercase letter.";
          }
          return undefined;
        },
      })
    ).trim();
  }

  const voChoices = listVoFieldChoices(workspaceRoot, domainPackageSlug);
  if (voChoices.length === 0) {
    console.error(
      pc.red(
        `No value objects found in @domain/core or @domain/${domainPackageSlug}. Create VOs first.`
      )
    );
    return;
  }

  const voPick = await promptSelect({
    message: "Value object type",
    options: voChoices.map((c) => ({ value: c.value, label: c.label })),
  });

  await runGenerateDomainEntityAddVoFieldCommand({
    workspaceRoot,
    domainPackageSlugInput: domainPackageSlug,
    entityPascalInput: entityPascal,
    propertyNameInput: propertyName,
    voClass: voPick.voClass,
    voSource: voPick.source,
  });
}
