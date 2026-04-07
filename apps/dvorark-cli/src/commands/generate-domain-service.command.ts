import path from "node:path";

import { kebabCase, pascalCase } from "case-anything";
import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const inputSchema = z.object({
  workspaceRoot: z.string().min(1),
  domainPackageSlugInput: z.string().min(1, "Domain package is required"),
  serviceNameInput: z.string().min(1, "Service name is required"),
  selectedEntityPascalNames: z.array(z.string().min(1)).min(1, "At least one entity is required"),
});

export interface GenerateDomainServiceCommandOptions {
  workspaceRoot: string;
  domainPackageSlugInput: string;
  serviceNameInput: string;
  selectedEntityPascalNames: string[];
}

export function printDomainServiceNoInteractiveHint(): void {
  console.error(
    pc.red(
      "Missing required arguments in non-interactive mode. Pass --domain-package, --service-name, --entities (comma-separated), or unset CI / DVORARK_NO_INTERACTIVE."
    )
  );
}

/** Comma-separated entity stems (PascalCase or kebab); normalized like Plop values. */
export function parseEntityCsv(csv: string): string[] {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => pascalCase(kebabCase(s)));
}

export async function runGenerateDomainServiceCommand(
  options: GenerateDomainServiceCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);
  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Creating domain service…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.createDomainService().execute({
      workspaceRoot,
      domainPackageSlugInput: parsed.domainPackageSlugInput,
      serviceNameInput: parsed.serviceNameInput,
      selectedEntityPascalNames: parsed.selectedEntityPascalNames,
    });

    spin.stop(
      pc.green(
        `Created ${pc.cyan(`${result.serviceKebab}.service.ts`)} in @domain/${result.domainPackageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
