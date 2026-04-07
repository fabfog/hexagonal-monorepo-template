import path from "node:path";

import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const inputSchema = z.object({
  workspaceRoot: z.string().min(1),
  domainPackageSlugInput: z.string().min(1, "Domain package is required"),
  entityPascalInput: z.string().min(1, "Entity is required"),
  propertyNameInput: z.string().min(1, "Property name is required"),
  voClass: z.string().min(1),
  voSource: z.enum(["core", "local"]),
});

export interface GenerateDomainEntityAddVoFieldCommandOptions {
  workspaceRoot: string;
  domainPackageSlugInput: string;
  entityPascalInput: string;
  propertyNameInput: string;
  voClass: string;
  voSource: "core" | "local";
}

export function printDomainEntityAddVoFieldNoInteractiveHint(): void {
  console.error(
    pc.red(
      "Missing required arguments in non-interactive mode. Pass --domain-package, --entity, --property, --vo-class, --vo-source (core|local), or unset CI / DVORARK_NO_INTERACTIVE."
    )
  );
}

export async function runGenerateDomainEntityAddVoFieldCommand(
  options: GenerateDomainEntityAddVoFieldCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);
  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Adding VO field to domain entity…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.addDomainEntityVoField().execute({
      workspaceRoot,
      domainPackageSlugInput: parsed.domainPackageSlugInput,
      entityPascalInput: parsed.entityPascalInput,
      propertyNameInput: parsed.propertyNameInput,
      voClass: parsed.voClass,
      voSource: parsed.voSource,
    });

    spin.stop(
      pc.green(
        `Added property ${pc.cyan(result.propertyName)} to ${pc.cyan(`${result.entityPascal}.entity.ts`)} in @domain/${result.domainPackageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
