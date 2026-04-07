import path from "node:path";

import { spinner } from "@clack/prompts";
import pc from "picocolors";
import { z } from "zod";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

const primitiveSchema = z.enum(["string", "boolean", "number", "Date"]);
const kindSchema = z.enum(["single-value", "composite"]);

const inputSchema = z.object({
  workspaceRoot: z.string().min(1),
  domainPackageSlugInput: z.string().min(1, "Domain package is required"),
  valueObjectSlugInput: z.string().min(1, "Value object name or slug is required"),
  valueObjectKind: kindSchema,
});

export type ValueObjectKindCli = z.infer<typeof kindSchema>;
export type SingleValuePrimitiveCli = z.infer<typeof primitiveSchema>;

export interface GenerateDomainValueObjectCommandOptions {
  workspaceRoot: string;
  domainPackageSlugInput: string;
  valueObjectSlugInput: string;
  valueObjectKind: ValueObjectKindCli;
  singleValuePrimitive?: SingleValuePrimitiveCli;
  zodVersionOverride?: string;
}

export function printDomainValueObjectNoInteractiveHint(): void {
  console.error(
    pc.red(
      "Missing required arguments in non-interactive mode. Pass value object slug and --domain-package <slug>, or unset CI / DVORARK_NO_INTERACTIVE."
    )
  );
}

export async function runGenerateDomainValueObjectCommand(
  options: GenerateDomainValueObjectCommandOptions
): Promise<void> {
  const parsed = inputSchema.parse(options);
  const singleValuePrimitive =
    parsed.valueObjectKind === "single-value"
      ? primitiveSchema.parse(options.singleValuePrimitive ?? "string")
      : undefined;

  const workspaceRoot = path.resolve(parsed.workspaceRoot);

  const spin = spinner();
  spin.start(pc.dim("Creating domain value object…"));

  try {
    const { dvorarkGenerators } = getDvorarkCliModules({});
    const result = await dvorarkGenerators.createDomainValueObject().execute({
      workspaceRoot,
      domainPackageSlugInput: parsed.domainPackageSlugInput,
      valueObjectSlugInput: parsed.valueObjectSlugInput,
      valueObjectKind: parsed.valueObjectKind,
      ...(singleValuePrimitive !== undefined ? { singleValuePrimitive } : {}),
      ...(options.zodVersionOverride !== undefined
        ? { zodVersionOverride: options.zodVersionOverride.trim() }
        : {}),
    });

    spin.stop(
      pc.green(
        `Created ${pc.cyan(`${result.valueObjectSlug}.vo.ts`)} (${result.valueObjectKind}) in @domain/${result.domainPackageSlug} (${String(result.filesWritten)} file(s)) under ${pc.cyan(workspaceRoot)}`
      )
    );
  } catch (error) {
    spin.stop(pc.red("Failed."));
    throw error;
  }
}
