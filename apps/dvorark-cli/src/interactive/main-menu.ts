import path from "node:path";

import { cancel, isCancel, select } from "@clack/prompts";
import pc from "picocolors";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

import { runGenerateMenu } from "./generate/menu";

function printBootstrapHint(targetDirectory: string): void {
  const resolved = path.resolve(targetDirectory);
  console.log(
    pc.yellow(`No Dvorark workspace in ${pc.dim(resolved)} (${pc.dim("dvorark.json")} not found).`)
  );
  console.log();
  console.log(pc.dim("Bootstrap a new workspace with:"));
  console.log(`  ${pc.cyan("dvorark create <target-directory>")}`);
  console.log();
  console.log(pc.dim("Example:"));
  console.log(`  ${pc.cyan(`dvorark create ${path.join(resolved, "my-workspace")}`)}`);
}

export async function runInteractiveMainMenu(targetDirectory: string): Promise<void> {
  const target = path.resolve(targetDirectory);
  const { workspaceBootstrap } = getDvorarkCliModules({});
  const status = await workspaceBootstrap.getWorkspaceStatus().execute({
    targetDirectory: target,
  });

  if (status.status !== "ready") {
    printBootstrapHint(target);
    return;
  }

  for (;;) {
    const choice = await select({
      message: `${pc.bold("Dvorark")} ${pc.dim(`(${target})`)}`,
      options: [
        { value: "generate", label: "Generate" },
        { value: "exit", label: "Exit" },
      ],
    });

    if (isCancel(choice)) {
      cancel("Bye.");
      process.exit(0);
    }

    if (choice === "exit") {
      process.exit(0);
    }

    if (choice === "generate") {
      await runGenerateMenu(target);
    }
  }
}
