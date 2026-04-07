import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";
import pc from "picocolors";

import { runCreateCommand } from "./commands/create.command";
import { runGenerateApplicationPackageCommand } from "./commands/generate-application-package.command";
import { runGenerateDomainPackageCommand } from "./commands/generate-domain-package.command";
import {
  printNoInteractiveHint,
  runApplicationPackageWizard,
  runDomainPackageWizard,
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
          "Interactive mode disabled. Run e.g. dvorark generate domain-package <slug> or generate application-package <slug>, or unset CI / DVORARK_NO_INTERACTIVE."
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
          "Interactive mode disabled. Run e.g. dvorark generate domain-package <slug> or generate application-package <slug>, or unset CI / DVORARK_NO_INTERACTIVE."
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

  await program.parseAsync(argv);
}
