import { runCreateCommand } from "./commands/create.command";
import { runWorkspaceCommand } from "./commands/workspace.command";

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  const [command, ...rest] = args;

  if (!command) {
    await runWorkspaceCommand();
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
  process.exitCode = 1;
});
