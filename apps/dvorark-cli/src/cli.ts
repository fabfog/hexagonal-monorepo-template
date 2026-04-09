import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";
import pc from "picocolors";

import { runCreateCommand } from "./commands/create.command";
import { runGenerateApplicationPackageCommand } from "./commands/generate-application-package.command";
import {
  printDomainEntityAddVoFieldNoInteractiveHint,
  runGenerateDomainEntityAddVoFieldCommand,
} from "./commands/generate-domain-entity-add-vo-field.command";
import {
  printDomainEntityNoInteractiveHint,
  runGenerateDomainEntityCommand,
} from "./commands/generate-domain-entity.command";
import {
  printDomainErrorNoInteractiveHint,
  runGenerateDomainErrorCommand,
} from "./commands/generate-domain-error.command";
import {
  parseEntityCsv,
  printDomainServiceNoInteractiveHint,
  runGenerateDomainServiceCommand,
} from "./commands/generate-domain-service.command";
import {
  printDomainValueObjectNoInteractiveHint,
  runGenerateDomainValueObjectCommand,
} from "./commands/generate-domain-value-object.command";
import { runGenerateDomainPackageCommand } from "./commands/generate-domain-package.command";
import { runGenerateCompositionPackageCommand } from "./commands/generate-composition-package.command";
import { runGenerateUiPackageCommand } from "./commands/generate-ui-package.command";
import {
  printNoInteractiveHint,
  runApplicationPackageWizard,
  runCompositionPackageWizard,
  runUiPackageWizard,
  runDomainEntityAddVoFieldWizard,
  runDomainEntityWizard,
  runDomainErrorWizard,
  runDomainPackageWizard,
  runDomainServiceWizard,
  runDomainValueObjectWizard,
  runGenerateMenu,
  runInteractiveMainMenu,
} from "./interactive";

const cliPackageJsonPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "package.json"
);
const CLI_VERSION = (JSON.parse(readFileSync(cliPackageJsonPath, "utf8")) as { version: string })
  .version;

/**
 * Strips a leading `--` when pnpm forwards it (e.g. `pnpm dvorark -- create …`).
 */
function normalizeProcessArgv(argv: string[]): string[] {
  const copy = [...argv];
  const rest = copy.slice(2);
  if (rest[0] === "--") {
    return [copy[0]!, copy[1]!, ...rest.slice(1)];
  }
  return copy;
}

function isNonInteractive(argv: string[]): boolean {
  return (
    process.env.CI === "true" ||
    process.env.DVORARK_NO_INTERACTIVE === "1" ||
    argv.slice(2).includes("--no-interactive")
  );
}

export async function runCli(): Promise<void> {
  const argv = normalizeProcessArgv(process.argv);
  const rest = argv.slice(2);

  if (rest.length === 0) {
    if (isNonInteractive(argv)) {
      console.error(
        pc.red(
          "Interactive mode disabled. Pass a target directory (e.g. dvorark .) or a subcommand, or unset CI / DVORARK_NO_INTERACTIVE."
        )
      );
      process.exit(1);
    }
    await runInteractiveMainMenu(process.cwd());
    return;
  }

  if (rest.length === 1 && rest[0] === "generate") {
    if (isNonInteractive(argv)) {
      console.error(
        pc.red(
          "Interactive mode disabled. Run e.g. dvorark generate domain-package <slug>, generate application-package <slug>, generate composition-package <slug>, or unset CI / DVORARK_NO_INTERACTIVE."
        )
      );
      process.exit(1);
    }
    await runGenerateMenu(process.cwd());
    return;
  }

  if (
    rest.length === 1 &&
    !rest[0]!.startsWith("-") &&
    rest[0] !== "create" &&
    rest[0] !== "help"
  ) {
    if (isNonInteractive(argv)) {
      console.error(
        pc.red(
          "Interactive mode disabled. Run e.g. dvorark generate domain-package <slug>, generate application-package <slug>, generate composition-package <slug>, or unset CI / DVORARK_NO_INTERACTIVE."
        )
      );
      process.exit(1);
    }
    await runInteractiveMainMenu(path.resolve(process.cwd(), rest[0]!));
    return;
  }

  const program = new Command();
  program.name("dvorark");
  program.description("Dvorark toolkit CLI");
  program.version(CLI_VERSION, "-V, --version");
  program.configureHelp({ sortSubcommands: true });
  program.showHelpAfterError("(add --help for usage)");

  program
    .command("create")
    .description("Scaffold a new workspace from blueprints")
    .argument("<target-directory>", "Directory for the new workspace")
    .option("--install", "Run pnpm install after writing files")
    .action(async (targetDirectory: string, options: { install?: boolean }) => {
      await runCreateCommand({
        targetDirectory,
        install: options.install ?? false,
      });
    });

  const generate = program.command("generate").description("Run code generators");

  generate
    .command("domain-package")
    .description("Create a new @domain/* package under packages/domain")
    .argument(
      "[package-slug]",
      "Package segment (e.g. user, user-profile); omit to prompt interactively"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/domain (default: current directory)"
    )
    .option("--vitest <range>", "Override vitest devDependency range in generated package.json")
    .option(
      "--no-interactive",
      "Fail if slug is missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (
        packageSlug: string | undefined,
        options: { workspace?: string; vitest?: string; noInteractive?: boolean }
      ): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const slug = packageSlug?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        if (!slug) {
          if (noInteractive) {
            printNoInteractiveHint();
            process.exit(1);
          }
          await runDomainPackageWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(options.vitest !== undefined ? { vitestVersionOverride: options.vitest } : {}),
          });
          return;
        }

        await runGenerateDomainPackageCommand({
          workspaceRoot,
          packageSlugInput: slug,
          ...(options.vitest !== undefined ? { vitestVersionOverride: options.vitest } : {}),
        });
      }
    );

  generate
    .command("application-package")
    .description("Create a new @application/* package under packages/application")
    .argument(
      "[package-slug]",
      "Package segment (e.g. user, user-profile); omit to prompt interactively"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/application (default: current directory)"
    )
    .option("--vitest <range>", "Override vitest devDependency range in generated package.json")
    .option(
      "--no-interactive",
      "Fail if slug is missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (
        packageSlug: string | undefined,
        options: { workspace?: string; vitest?: string; noInteractive?: boolean }
      ): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const slug = packageSlug?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        if (!slug) {
          if (noInteractive) {
            printNoInteractiveHint();
            process.exit(1);
          }
          await runApplicationPackageWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(options.vitest !== undefined ? { vitestVersionOverride: options.vitest } : {}),
          });
          return;
        }

        await runGenerateApplicationPackageCommand({
          workspaceRoot,
          packageSlugInput: slug,
          ...(options.vitest !== undefined ? { vitestVersionOverride: options.vitest } : {}),
        });
      }
    );

  generate
    .command("ui-package")
    .description("Create a new @ui/* package under packages/ui")
    .argument(
      "[package-slug]",
      "Package segment (e.g. react, editor-shell); omit to prompt interactively"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/ui (default: current directory)"
    )
    .option("--vitest <range>", "Override vitest devDependency range in generated package.json")
    .option(
      "--no-interactive",
      "Fail if slug is missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (
        packageSlug: string | undefined,
        options: { workspace?: string; vitest?: string; noInteractive?: boolean }
      ): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const slug = packageSlug?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        if (!slug) {
          if (noInteractive) {
            printNoInteractiveHint();
            process.exit(1);
          }
          await runUiPackageWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(options.vitest !== undefined ? { vitestVersionOverride: options.vitest } : {}),
          });
          return;
        }

        await runGenerateUiPackageCommand({
          workspaceRoot,
          packageSlugInput: slug,
          ...(options.vitest !== undefined ? { vitestVersionOverride: options.vitest } : {}),
        });
      }
    );

  generate
    .command("composition-package")
    .description("Create a new @composition/* package under packages/composition")
    .argument(
      "[package-slug]",
      "Package segment (e.g. web, api-shell); omit to prompt interactively"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/composition (default: current directory)"
    )
    .option(
      "--no-interactive",
      "Fail if slug is missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (
        packageSlug: string | undefined,
        options: { workspace?: string; noInteractive?: boolean }
      ): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const slug = packageSlug?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        if (!slug) {
          if (noInteractive) {
            printNoInteractiveHint();
            process.exit(1);
          }
          await runCompositionPackageWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
          });
          return;
        }

        await runGenerateCompositionPackageCommand({
          workspaceRoot,
          packageSlugInput: slug,
        });
      }
    );

  generate
    .command("domain-entity")
    .description("Create a domain entity file under packages/domain/<pkg>/src/entities/")
    .argument("[entity-slug]", "Entity segment (e.g. line-item); omit to prompt interactively")
    .option(
      "--domain-package <slug>",
      "Domain package folder under packages/domain (required with entity slug in non-interactive mode)"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/domain (default: current directory)"
    )
    .option("--zod <range>", "Override zod semver range when patching domain package.json")
    .option(
      "--no-interactive",
      "Fail if entity slug or domain package is missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (
        entitySlugArg: string | undefined,
        options: {
          domainPackage?: string;
          workspace?: string;
          zod?: string;
          noInteractive?: boolean;
        }
      ): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const entitySlug = entitySlugArg?.trim();
        const domainPkg = options.domainPackage?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        if (!entitySlug || !domainPkg) {
          if (noInteractive) {
            printDomainEntityNoInteractiveHint();
            process.exit(1);
          }
          await runDomainEntityWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(domainPkg ? { domainPackageSlug: domainPkg } : {}),
            ...(entitySlug ? { entitySlug } : {}),
          });
          return;
        }

        await runGenerateDomainEntityCommand({
          workspaceRoot,
          domainPackageSlugInput: domainPkg,
          entitySlugInput: entitySlug,
          ...(options.zod !== undefined ? { zodVersionOverride: options.zod } : {}),
        });
      }
    );

  generate
    .command("domain-entity-add-vo-field")
    .description(
      "Add one Zod + VO-backed property to an existing domain entity (re-run for more fields)"
    )
    .option(
      "--domain-package <slug>",
      "Domain package folder under packages/domain (required in non-interactive mode)"
    )
    .option(
      "--entity <Pascal>",
      "Entity PascalCase stem (e.g. LineItem); required in non-interactive mode"
    )
    .option("--property <name>", "camelCase property name; required in non-interactive mode")
    .option("--vo-class <Name>", "VO class name (e.g. Email); required in non-interactive mode")
    .option("--vo-source <source>", "core | local; required in non-interactive mode")
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/domain (default: current directory)"
    )
    .option(
      "--no-interactive",
      "Fail if required options are missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (options: {
        domainPackage?: string;
        entity?: string;
        property?: string;
        voClass?: string;
        voSource?: string;
        workspace?: string;
        noInteractive?: boolean;
      }): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const domainPkg = options.domainPackage?.trim();
        const entityPascal = options.entity?.trim();
        const propertyName = options.property?.trim();
        const voClass = options.voClass?.trim();
        const voSourceRaw = options.voSource?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        const complete =
          domainPkg &&
          entityPascal &&
          propertyName &&
          voClass &&
          (voSourceRaw === "core" || voSourceRaw === "local");

        if (!complete) {
          if (noInteractive) {
            printDomainEntityAddVoFieldNoInteractiveHint();
            process.exit(1);
          }
          await runDomainEntityAddVoFieldWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(domainPkg ? { domainPackageSlug: domainPkg } : {}),
            ...(entityPascal ? { entityPascal } : {}),
            ...(propertyName ? { propertyName } : {}),
          });
          return;
        }

        await runGenerateDomainEntityAddVoFieldCommand({
          workspaceRoot,
          domainPackageSlugInput: domainPkg,
          entityPascalInput: entityPascal,
          propertyNameInput: propertyName,
          voClass,
          voSource: voSourceRaw,
        });
      }
    );

  generate
    .command("domain-value-object")
    .description(
      "Add a Value Object (single-value or composite) to packages/domain/<pkg>/src/value-objects/"
    )
    .argument(
      "[value-object-slug]",
      "Name or slug (e.g. UserId, ticket-id); omit to prompt interactively"
    )
    .option(
      "--domain-package <slug>",
      "Domain package folder under packages/domain (required with slug in non-interactive mode)"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/domain (default: current directory)"
    )
    .option("--vo-kind <kind>", "single-value or composite (default: single-value)", "single-value")
    .option(
      "--primitive <type>",
      "For single-value: string | boolean | number | Date (default: string)"
    )
    .option("--zod <range>", "Override zod semver range when patching domain package.json")
    .option(
      "--no-interactive",
      "Fail if slug or domain package is missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (
        valueObjectSlugArg: string | undefined,
        options: {
          domainPackage?: string;
          workspace?: string;
          voKind?: string;
          primitive?: string;
          zod?: string;
          noInteractive?: boolean;
        }
      ): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const voSlug = valueObjectSlugArg?.trim();
        const domainPkg = options.domainPackage?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        const voKindRaw = options.voKind?.trim() ?? "single-value";
        if (voKindRaw !== "single-value" && voKindRaw !== "composite") {
          console.error(
            pc.red(`--vo-kind must be single-value or composite (got ${JSON.stringify(voKindRaw)})`)
          );
          process.exit(1);
        }
        const isComposite = voKindRaw === "composite";
        const valueObjectKind = isComposite ? "composite" : "single-value";

        if (!voSlug || !domainPkg) {
          if (noInteractive) {
            printDomainValueObjectNoInteractiveHint();
            process.exit(1);
          }
          await runDomainValueObjectWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(domainPkg ? { domainPackageSlug: domainPkg } : {}),
            ...(voSlug ? { valueObjectSlug: voSlug } : {}),
          });
          return;
        }

        let singleValuePrimitive: "string" | "boolean" | "number" | "Date" | undefined;
        if (!isComposite) {
          const p = options.primitive?.trim() ?? "string";
          if (!["string", "boolean", "number", "Date"].includes(p)) {
            console.error(
              pc.red(
                `--primitive must be one of string, boolean, number, Date (got ${JSON.stringify(p)})`
              )
            );
            process.exit(1);
          }
          singleValuePrimitive = p as "string" | "boolean" | "number" | "Date";
        }

        await runGenerateDomainValueObjectCommand({
          workspaceRoot,
          domainPackageSlugInput: domainPkg,
          valueObjectSlugInput: voSlug,
          valueObjectKind,
          ...(singleValuePrimitive !== undefined ? { singleValuePrimitive } : {}),
          ...(options.zod !== undefined ? { zodVersionOverride: options.zod } : {}),
        });
      }
    );

  generate
    .command("domain-error")
    .description("Add a DomainError subclass under packages/domain/<pkg>/src/errors/")
    .option(
      "--domain-package <slug>",
      "Domain package folder under packages/domain (required in non-interactive mode)"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/domain (default: current directory)"
    )
    .option("--error-kind <kind>", "not-found or custom (required in non-interactive mode)")
    .option("--entity <Pascal>", "Entity name for not-found (e.g. User)")
    .option("--error-name <name>", "Error name segment for custom (e.g. InvalidState)")
    .option(
      "--no-interactive",
      "Fail if required options are missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (options: {
        domainPackage?: string;
        workspace?: string;
        errorKind?: string;
        entity?: string;
        errorName?: string;
        noInteractive?: boolean;
      }): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const domainPkg = options.domainPackage?.trim();
        const errorKindRaw = options.errorKind?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        const needsWizard =
          !domainPkg ||
          !errorKindRaw ||
          (errorKindRaw === "not-found" && !options.entity?.trim()) ||
          (errorKindRaw === "custom" && !options.errorName?.trim());

        if (needsWizard) {
          if (noInteractive) {
            printDomainErrorNoInteractiveHint();
            process.exit(1);
          }
          await runDomainErrorWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(domainPkg ? { domainPackageSlug: domainPkg } : {}),
          });
          return;
        }

        if (errorKindRaw !== "not-found" && errorKindRaw !== "custom") {
          console.error(
            pc.red(`--error-kind must be not-found or custom (got ${JSON.stringify(errorKindRaw)})`)
          );
          process.exit(1);
        }

        try {
          await runGenerateDomainErrorCommand({
            workspaceRoot,
            domainPackageSlugInput: domainPkg,
            errorKind: errorKindRaw,
            ...(errorKindRaw === "not-found"
              ? { entityPascalInput: options.entity!.trim() }
              : { customErrorNameInput: options.errorName!.trim() }),
          });
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("--")) {
            console.error(pc.red(e.message));
            process.exit(1);
          }
          throw e;
        }
      }
    );

  generate
    .command("domain-service")
    .description(
      "Add a domain service (execute + Input/Output) under packages/domain/<pkg>/src/services/"
    )
    .option(
      "--domain-package <slug>",
      "Domain package folder under packages/domain (required in non-interactive mode)"
    )
    .option(
      "--service-name <name>",
      "Service base name without Service suffix (required in non-interactive mode)"
    )
    .option(
      "--entities <list>",
      "Comma-separated entity stems (e.g. User,LineItem); required in non-interactive mode"
    )
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/domain (default: current directory)"
    )
    .option(
      "--no-interactive",
      "Fail if required options are missing (CI; also respects CI / DVORARK_NO_INTERACTIVE)"
    )
    .action(
      async (options: {
        domainPackage?: string;
        workspace?: string;
        serviceName?: string;
        entities?: string;
        noInteractive?: boolean;
      }): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        const domainPkg = options.domainPackage?.trim();
        const serviceName = options.serviceName?.trim();
        const entitiesRaw = options.entities?.trim();
        const noInteractive = isNonInteractive(argv) || options.noInteractive === true;

        const needsWizard = !domainPkg || !serviceName || !entitiesRaw;

        if (needsWizard) {
          if (noInteractive) {
            printDomainServiceNoInteractiveHint();
            process.exit(1);
          }
          await runDomainServiceWizard({
            ...(options.workspace ? { workspaceRoot } : {}),
            ...(domainPkg ? { domainPackageSlug: domainPkg } : {}),
          });
          return;
        }

        const selectedEntityPascalNames = parseEntityCsv(entitiesRaw);
        if (selectedEntityPascalNames.length === 0) {
          console.error(pc.red("--entities must list at least one entity"));
          process.exit(1);
        }

        await runGenerateDomainServiceCommand({
          workspaceRoot,
          domainPackageSlugInput: domainPkg,
          serviceNameInput: serviceName,
          selectedEntityPascalNames,
        });
      }
    );

  await program.parseAsync(argv);
}
