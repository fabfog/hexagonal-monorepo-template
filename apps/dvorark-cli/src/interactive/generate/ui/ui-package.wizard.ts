import path from "node:path";

import pc from "picocolors";

import { runGenerateUiPackageCommand } from "../../../commands/generate-ui-package.command";
import { promptText } from "../../prompts";

export interface UiPackageWizardInput {
  packageSlug?: string;
  workspaceRoot?: string;
  vitestVersionOverride?: string;
}

export async function runUiPackageWizard(partial: UiPackageWizardInput = {}): Promise<void> {
  let packageSlug = partial.packageSlug?.trim();
  if (!packageSlug) {
    const slugInput = await promptText({
      message: "UI package slug or name (e.g. react, EditorShell)",
      placeholder: "user",
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    });
    packageSlug = slugInput.trim();
  }

  let workspaceRoot = partial.workspaceRoot;
  if (!workspaceRoot) {
    const workspaceInput = await promptText({
      message: "Monorepo root (contains packages/ui)",
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

  await runGenerateUiPackageCommand({
    workspaceRoot,
    packageSlugInput: packageSlug,
    ...(vitestVersionOverride !== undefined ? { vitestVersionOverride } : {}),
  });
}

export function printUiPackageNoInteractiveHint(): void {
  console.error(
    pc.red(
      "Missing required arguments in non-interactive mode. Pass a package slug or unset CI / DVORARK_NO_INTERACTIVE."
    )
  );
}
