import path from "node:path";

import pc from "picocolors";

import { runGenerateDomainEntityCommand } from "../../../commands/generate-domain-entity.command";
import { promptSelect, promptText } from "../../prompts";
import { listDomainPackageSlugs } from "./list-domain-packages";

export interface DomainEntityWizardInput {
  workspaceRoot?: string;
  domainPackageSlug?: string;
  entitySlug?: string;
}

export async function runDomainEntityWizard(partial: DomainEntityWizardInput = {}): Promise<void> {
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
    const choices = listDomainPackageSlugs(workspaceRoot);
    if (choices.length === 0) {
      console.error(
        pc.red(
          "No domain packages available for entity generation. Add a feature package under `packages/domain/` first (e.g. `dvorark generate domain-package <slug>`). The shared `@domain/core` package is not listed."
        )
      );
      return;
    }
    domainPackageSlug = await promptSelect({
      message: "Domain package under packages/domain",
      options: choices.map((slug) => ({ value: slug, label: slug })),
    });
  }

  let entitySlug = partial.entitySlug?.trim();
  if (!entitySlug) {
    entitySlug = (
      await promptText({
        message: "Entity name or slug (e.g. line-item, OrderLine)",
        placeholder: "ticket",
        validate: (v) => (!v?.trim() ? "Required" : undefined),
      })
    ).trim();
  }

  await runGenerateDomainEntityCommand({
    workspaceRoot,
    domainPackageSlugInput: domainPackageSlug,
    entitySlugInput: entitySlug,
  });
}
