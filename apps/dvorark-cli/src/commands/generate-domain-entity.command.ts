import path from "node:path";

import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const inputSchema = z.object({
  workspaceRoot: z.string().min(1),
  domainPackageSlugInput: z.string().min(1, "Domain package is required"),
  entitySlugInput: z.string().min(1, "Entity slug is required"),
});

export interface GenerateDomainEntityCommandOptions {
  workspaceRoot: string;
  domainPackageSlugInput: string;
  entitySlugInput: string;
  /** Override zod range when patching domain package.json (default: workspace resolution). */
  zodVersionOverride?: string;
}

export function printDomainEntityNoInteractiveHint(): void {
  console.error(
    pc.red(
      "Missing required arguments in non-interactive mode. Pass entity slug and --domain-package <slug>, or unset CI / DVORARK_NO_INTERACTIVE."
    )
  );
}

export async function runGenerateDomainEntityCommand(
  options: GenerateDomainEntityCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);
  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Creating domain entity…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.createDomainEntity().execute({
      workspaceRoot,
      domainPackageSlugInput: parsed.domainPackageSlugInput,
      entitySlugInput: parsed.entitySlugInput,
      ...(options.zodVersionOverride !== undefined
        ? { zodVersionOverride: options.zodVersionOverride.trim() }
        : {}),
    });

    spin.stop(
      pc.green(
        `Created ${pc.cyan(`${result.entitySlug}.entity.ts`)} in @domain/${result.domainPackageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
