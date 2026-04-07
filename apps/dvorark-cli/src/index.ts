import { runCreateCommand } from "./commands/create.command";

function printUsage(): void {
  console.log("Usage: dvorark create <target-directory> [--install]");
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const [command, ...rest] = args;

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "create") {
    await runCreateCommand(rest);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dvorark] ${message}`);
  process.exit(1);
});
