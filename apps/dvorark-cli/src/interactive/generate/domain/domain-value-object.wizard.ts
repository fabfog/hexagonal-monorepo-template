import path from "node:path";

import pc from "picocolors";
import { getDvorarkCliModules } from "@composition/dvorark-cli";

import { runGenerateDomainValueObjectCommand } from "../../../commands/generate-domain-value-object.command";
import { promptSelect, promptText } from "../../prompts";

export interface DomainValueObjectWizardInput {
  workspaceRoot?: string;
  domainPackageSlug?: string;
  valueObjectSlug?: string;
}

export async function runDomainValueObjectWizard(
  partial: DomainValueObjectWizardInput = {}
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

  let valueObjectSlug = partial.valueObjectSlug?.trim();
  if (!valueObjectSlug) {
    valueObjectSlug = (
      await promptText({
        message:
          "Value Object base name (e.g. UserId, EmailAddress). Class name matches; file will be `<kebab>.vo.ts`.",
        placeholder: "TicketId",
        validate: (v) => (!v?.trim() ? "Required" : undefined),
      })
    ).trim();
  }

  const valueObjectKind = await promptSelect({
    message: "VO shape",
    options: [
      {
        value: "single-value" as const,
        label: "Single value VO — wraps one primitive value (`value`)",
      },
      {
        value: "composite" as const,
        label: "Composite VO — object props + `getProps()` + default deep equals",
      },
    ],
  });

  let singleValuePrimitive: "string" | "boolean" | "number" | "Date" | undefined;
  if (valueObjectKind === "single-value") {
    singleValuePrimitive = await promptSelect({
      message: "Single value primitive type",
      options: [
        { value: "string" as const, label: "string" },
        { value: "boolean" as const, label: "boolean" },
        { value: "number" as const, label: "number" },
        { value: "Date" as const, label: "Date" },
      ],
    });
  }

  await runGenerateDomainValueObjectCommand({
    workspaceRoot,
    domainPackageSlugInput: domainPackageSlug,
    valueObjectSlugInput: valueObjectSlug,
    valueObjectKind,
    ...(singleValuePrimitive !== undefined ? { singleValuePrimitive } : {}),
  });
}
