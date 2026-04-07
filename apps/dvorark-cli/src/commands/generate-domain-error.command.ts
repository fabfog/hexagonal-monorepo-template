import path from "node:path";

import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const kindSchema = z.enum(["not-found", "custom"]);

const inputSchema = z.object({
  workspaceRoot: z.string().min(1),
  domainPackageSlugInput: z.string().min(1, "Domain package is required"),
  errorKind: kindSchema,
  entityPascalInput: z.string().optional(),
  customErrorNameInput: z.string().optional(),
});

export type DomainErrorKindCli = z.infer<typeof kindSchema>;

export interface GenerateDomainErrorCommandOptions {
  workspaceRoot: string;
  domainPackageSlugInput: string;
  errorKind: DomainErrorKindCli;
  entityPascalInput?: string;
  customErrorNameInput?: string;
}

export function printDomainErrorNoInteractiveHint(): void {
  console.error(
    pc.red(
      "Missing required arguments in non-interactive mode. Pass --domain-package, --error-kind not-found|custom, and --entity (not-found) or --error-name (custom), or unset CI / DVORARK_NO_INTERACTIVE."
    )
  );
}

export async function runGenerateDomainErrorCommand(
  options: GenerateDomainErrorCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);

  if (parsed.errorKind === "not-found") {
    const e = parsed.entityPascalInput?.trim();
    if (!e) {
      throw new Error("--entity is required when --error-kind is not-found");
    }
  } else {
    const n = parsed.customErrorNameInput?.trim();
    if (!n) {
      throw new Error("--error-name is required when --error-kind is custom");
    }
  }

  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Creating domain error…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.createDomainError().execute({
      workspaceRoot,
      domainPackageSlugInput: parsed.domainPackageSlugInput,
      errorKind: parsed.errorKind,
      ...(parsed.errorKind === "not-found"
        ? { entityPascalInput: parsed.entityPascalInput!.trim() }
        : { customErrorNameInput: parsed.customErrorNameInput!.trim() }),
    });

    spin.stop(
      pc.green(
        `Created ${pc.cyan(`${result.errorFileKebab}.error.ts`)} (${result.errorKind}) in @domain/${result.domainPackageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
