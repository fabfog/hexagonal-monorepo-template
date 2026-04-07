import path from "node:path";

import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const createInputSchema = z.object({
  targetDirectory: z.string().min(1, "Target directory is required"),
  install: z.boolean(),
});

export interface CreateCommandOptions {
  targetDirectory: string;
  install: boolean;
}

export async function runCreateCommand(options: CreateCommandOptions): Promise<void> {
  const parsed = createInputSchema.parse(options);
  const targetDirectory = path.resolve(process.cwd(), parsed.targetDirectory);
  const repoName = path.basename(targetDirectory);
  const installDependencies = parsed.install;

  const spin = spinner();
  spin.start(pc.dim("Scaffolding workspace…"));

  try {
    const { workspaceBootstrap } = getDvorarkCliModules({});
    const result = await workspaceBootstrap.createWorkspaceFromBlueprint().execute({
      targetDirectory,
      repoName,
      installDependencies,
    });

    spin.stop(
      pc.green(`Wrote ${String(result.filesWritten)} file(s) to ${pc.cyan(targetDirectory)}`)
    );
    if (installDependencies) {
      console.log(pc.dim("pnpm install completed."));
    }
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
