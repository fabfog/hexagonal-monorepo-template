import path from "node:path";

import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const inputSchema = z.object({
  workspaceRoot: z.string().min(1),
  packageSlugInput: z.string().min(1, "Package name is required"),
});

export interface GenerateCompositionPackageCommandOptions {
  workspaceRoot: string;
  packageSlugInput: string;
}

export async function runGenerateCompositionPackageCommand(
  options: GenerateCompositionPackageCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);
  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Creating composition package…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.createCompositionPackage().execute({
      workspaceRoot,
      packageSlugInput: parsed.packageSlugInput,
    });

    spin.stop(
      pc.green(
        `Created @composition/${result.packageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
