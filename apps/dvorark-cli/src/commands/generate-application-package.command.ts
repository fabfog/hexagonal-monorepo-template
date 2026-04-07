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

export type GenerateApplicationPackageCommandOptions = {
  workspaceRoot: string;
  packageSlugInput: string;
} & { vitestVersionOverride?: string };

export async function runGenerateApplicationPackageCommand(
  options: GenerateApplicationPackageCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);
  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Creating application package…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.createApplicationPackage().execute({
      workspaceRoot,
      packageSlugInput: parsed.packageSlugInput,
      ...(parsed.vitestVersionOverride !== undefined
        ? { vitestVersionOverride: parsed.vitestVersionOverride }
        : {}),
    });

    spin.stop(
      pc.green(
        `Created @application/${result.packageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
