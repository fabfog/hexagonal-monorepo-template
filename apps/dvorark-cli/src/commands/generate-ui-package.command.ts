import path from "node:path";

import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const inputSchema = z.object({
  workspaceRoot: z.string().min(1),
  packageSlugInput: z.string().min(1, "Package name is required"),
  vitestVersionOverride: z.string().optional(),
});

export type GenerateUiPackageCommandOptions = {
  workspaceRoot: string;
  packageSlugInput: string;
} & { vitestVersionOverride?: string };

export async function runGenerateUiPackageCommand(
  options: GenerateUiPackageCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);
  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Creating UI package…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.createUiPackage().execute({
      workspaceRoot,
      packageSlugInput: parsed.packageSlugInput,
      ...(parsed.vitestVersionOverride !== undefined
        ? { vitestVersionOverride: parsed.vitestVersionOverride }
        : {}),
    });

    spin.stop(
      pc.green(
        `Created @ui/${result.packageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
