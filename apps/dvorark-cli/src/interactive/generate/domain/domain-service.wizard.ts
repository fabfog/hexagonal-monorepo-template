import path from "node:path";

import pc from "picocolors";

import { runGenerateDomainServiceCommand } from "../../../commands/generate-domain-service.command";
import { promptMultiselect, promptSelect, promptText } from "../../prompts";
import { listDomainEntityPascalNames } from "./list-domain-entities";
import { listDomainPackageSlugs } from "./list-domain-packages";

export interface DomainServiceWizardInput {
  workspaceRoot?: string;
  domainPackageSlug?: string;
}

export async function runDomainServiceWizard(
  partial: DomainServiceWizardInput = {}
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
    const choices = listDomainPackageSlugs(workspaceRoot, { excludeCore: true });
    if (choices.length === 0) {
      console.error(
        pc.red(
          "No domain packages available. Add a feature package under `packages/domain/` first (e.g. `dvorark generate domain-package <slug>`). `@domain/core` is not listed."
        )
      );
      return;
    }
    domainPackageSlug = await promptSelect({
      message: "Domain package under packages/domain",
      options: choices.map((slug) => ({ value: slug, label: slug })),
    });
  }

  const entityChoices = listDomainEntityPascalNames(workspaceRoot, domainPackageSlug);
  if (entityChoices.length === 0) {
    console.error(
      pc.red(
        `No entities in @domain/${domainPackageSlug}. Add entities first (e.g. domain entity generator).`
      )
    );
    return;
  }

  const selectedEntityPascalNames = await promptMultiselect({
    message: "Entities this service will use (space to toggle)",
    options: entityChoices.map((name) => ({ value: name, label: name })),
    required: true,
  });

  const serviceNameInput = (
    await promptText({
      message:
        "Service base name (WITHOUT the 'Service' suffix), e.g. UserDiscountEligibility, OrderShippingWindow",
      placeholder: "UserDiscountEligibility",
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    })
  )
    .trim()
    .replace(/Service$/i, "");

  await runGenerateDomainServiceCommand({
    workspaceRoot,
    domainPackageSlugInput: domainPackageSlug,
    serviceNameInput: serviceNameInput,
    selectedEntityPascalNames,
  });
}
