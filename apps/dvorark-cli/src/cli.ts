import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "commander";

import { runCreateCommand } from "./commands/create.command";
import { runGenerateDomainPackageCommand } from "./commands/generate-domain-package.command";
import { runWorkspaceCommand } from "./commands/workspace.command";

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

export async function runCli(): Promise<void> {
  const argv = normalizeProcessArgv(process.argv);
  const rest = argv.slice(2);

  if (rest.length === 0) {
    await runWorkspaceCommand();
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
    .argument("<package-slug>", "Package segment (e.g. user, user-profile)")
    .option(
      "--workspace <dir>",
      "Monorepo root containing packages/domain (default: current directory)"
    )
    .option("--vitest <range>", "Override vitest devDependency range in generated package.json")
    .action(
      async (
        packageSlug: string,
        options: { workspace?: string; vitest?: string }
      ): Promise<void> => {
        const workspaceRoot = options.workspace
          ? path.resolve(process.cwd(), options.workspace)
          : process.cwd();
        await runGenerateDomainPackageCommand({
          workspaceRoot,
          packageSlugInput: packageSlug,
          ...(options.vitest !== undefined ? { vitestVersionOverride: options.vitest } : {}),
        });
      }
    );

  await program.parseAsync(argv);
}
