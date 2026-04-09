import path from "node:path";

import { runGenerateCompositionPackageCommand } from "../../../commands/generate-composition-package.command";
import { promptText } from "../../prompts";

export interface CompositionPackageWizardInput {
  packageSlug?: string;
  workspaceRoot?: string;
}

export async function runCompositionPackageWizard(
  partial: CompositionPackageWizardInput = {}
): Promise<void> {
  let packageSlug = partial.packageSlug?.trim();
  if (!packageSlug) {
    const slugInput = await promptText({
      message: "Composition package slug or name (e.g. web, api, shell)",
      placeholder: "web",
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    });
    packageSlug = slugInput.trim();
  }

  let workspaceRoot = partial.workspaceRoot;
  if (!workspaceRoot) {
    const workspaceInput = await promptText({
      message: "Monorepo root (contains packages/composition)",
      initialValue: process.cwd(),
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    });
    workspaceRoot = path.resolve(workspaceInput.trim());
  } else {
    workspaceRoot = path.resolve(workspaceRoot);
  }

  await runGenerateCompositionPackageCommand({
    workspaceRoot,
    packageSlugInput: packageSlug,
  });
}
