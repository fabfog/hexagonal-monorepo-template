import path from "node:path";

import { cancel, isCancel, text } from "@clack/prompts";
import { runGenerateApplicationPackageCommand } from "../../../commands/generate-application-package.command";

export interface ApplicationPackageWizardInput {
  packageSlug?: string;
  workspaceRoot?: string;
  vitestVersionOverride?: string;
}

export async function runApplicationPackageWizard(
  partial: ApplicationPackageWizardInput = {}
): Promise<void> {
  let packageSlug = partial.packageSlug?.trim();
  if (!packageSlug) {
    const slugInput = await text({
      message: "Package slug or name (e.g. user, UserProfile)",
      placeholder: "user",
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    });
    if (isCancel(slugInput)) {
      cancel("Cancelled.");
      return;
    }
    packageSlug = String(slugInput).trim();
  }

  let workspaceRoot = partial.workspaceRoot;
  if (!workspaceRoot) {
    const workspaceInput = await text({
      message: "Monorepo root (contains packages/application)",
      initialValue: process.cwd(),
      validate: (v) => (!v?.trim() ? "Required" : undefined),
    });
    if (isCancel(workspaceInput)) {
      cancel("Cancelled.");
      return;
    }
    workspaceRoot = path.resolve(String(workspaceInput).trim());
  } else {
    workspaceRoot = path.resolve(workspaceRoot);
  }

  let vitestVersionOverride = partial.vitestVersionOverride;
  if (vitestVersionOverride === undefined) {
    const vitestInput = await text({
      message: "Vitest version range override (optional, empty = auto)",
      placeholder: "e.g. ^4.1.0",
    });
    if (isCancel(vitestInput)) {
      cancel("Cancelled.");
      return;
    }
    const trimmed = String(vitestInput ?? "").trim();
    vitestVersionOverride = trimmed === "" ? undefined : trimmed;
  }

  await runGenerateApplicationPackageCommand({
    workspaceRoot,
    packageSlugInput: packageSlug,
    ...(vitestVersionOverride !== undefined ? { vitestVersionOverride } : {}),
  });
}
