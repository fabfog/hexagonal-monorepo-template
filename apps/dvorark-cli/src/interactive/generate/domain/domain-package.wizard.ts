import path from "node:path";

import pc from "picocolors";

import { runGenerateDomainPackageCommand } from "../../../commands/generate-domain-package.command";
import { promptText } from "../../prompts";

export interface DomainPackageWizardInput {
  packageSlug?: string;
  workspaceRoot?: string;
  vitestVersionOverride?: string;
}

export async function runDomainPackageWizard(
  partial: DomainPackageWizardInput = {}
): Promise<void> {
  let packageSlug = partial.packageSlug?.trim();
  if (!packageSlug) {
    const slugInput = await promptText({
      message: "Package slug or name (e.g. user, UserProfile)",
      placeholder: "user",
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    });
    packageSlug = slugInput.trim();
  }

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

  let vitestVersionOverride = partial.vitestVersionOverride;
  if (vitestVersionOverride === undefined) {
    const vitestInput = await promptText({
      message: "Vitest version range override (optional, empty = auto)",
      placeholder: "e.g. ^4.1.0",
    });
    const trimmed = vitestInput.trim();
    vitestVersionOverride = trimmed === "" ? undefined : trimmed;
  }

  await runGenerateDomainPackageCommand({
    workspaceRoot,
    packageSlugInput: packageSlug,
    ...(vitestVersionOverride !== undefined ? { vitestVersionOverride } : {}),
  });
}

export function printNoInteractiveHint(): void {
  console.error(
    pc.red(
      "Missing required arguments in non-interactive mode. Pass a package slug or unset CI / DVORARK_NO_INTERACTIVE."
    )
  );
}
