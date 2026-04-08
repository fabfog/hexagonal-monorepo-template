import path from "node:path";

import pc from "picocolors";
import { getDvorarkCliModules } from "@composition/dvorark-cli";

import { runGenerateDomainErrorCommand } from "../../../commands/generate-domain-error.command";
import { promptSelect, promptText } from "../../prompts";

const ENTITY_PASCAL_RE = /^[A-Z][a-zA-Z0-9]*$/;

export interface DomainErrorWizardInput {
  workspaceRoot?: string;
  domainPackageSlug?: string;
}

export async function runDomainErrorWizard(partial: DomainErrorWizardInput = {}): Promise<void> {
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
    const choices = await getDvorarkCliModules({})
      .dvorarkGenerators.listDomainPackageSlugs()
      .execute({ workspaceRoot, excludeCore: false });
    if (choices.length === 0) {
      console.error(
        pc.red(
          "No domain packages found under `packages/domain/`. Add a package first (e.g. `dvorark generate domain-package <slug>`)."
        )
      );
      return;
    }
    domainPackageSlug = await promptSelect({
      message: "Domain package under packages/domain",
      options: choices.map((slug) => ({ value: slug, label: slug })),
    });
  }

  const errorKind = await promptSelect({
    message: "Error kind",
    options: [
      {
        value: "not-found" as const,
        label: "Not found — entity id in message & metadata (e.g. UserNotFoundError)",
      },
      {
        value: "custom" as const,
        label: "Other — custom name & static message (template)",
      },
    ],
  });

  if (errorKind === "not-found") {
    const entityPascal = (
      await promptText({
        message: "Entity name (PascalCase, e.g. User)",
        placeholder: "User",
        validate: (v) => {
          const t = v?.trim() ?? "";
          if (!t) return "Required";
          if (!ENTITY_PASCAL_RE.test(t)) {
            return "Use PascalCase (e.g. User, OrderLine)";
          }
          return undefined;
        },
      })
    ).trim();

    await runGenerateDomainErrorCommand({
      workspaceRoot,
      domainPackageSlugInput: domainPackageSlug,
      errorKind: "not-found",
      entityPascalInput: entityPascal,
    });
    return;
  }

  const customErrorName = (
    await promptText({
      message: "Error name (e.g. NotFound, InvalidState)",
      placeholder: "InvalidState",
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    })
  ).trim();

  await runGenerateDomainErrorCommand({
    workspaceRoot,
    domainPackageSlugInput: domainPackageSlug,
    errorKind: "custom",
    customErrorNameInput: customErrorName,
  });
}
