import path from "node:path";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

function printCreateUsage(): void {
  console.log("Usage: dvorark create <target-directory> [--install]");
}

export async function runCreateCommand(argv: string[]): Promise<void> {
  const targetArg = argv.find((arg) => !arg.startsWith("-"));
  if (!targetArg) {
    printCreateUsage();
    process.exitCode = 1;
    return;
  }

  const installDependencies = argv.includes("--install");
  const targetDirectory = path.resolve(process.cwd(), targetArg);
  const repoName = path.basename(targetDirectory);

  const { workspaceBootstrap } = getDvorarkCliModules({});
  const result = await workspaceBootstrap.createWorkspaceFromBlueprint().execute({
    targetDirectory,
    repoName,
    installDependencies,
  });

  console.log(
    `[dvorark create] wrote ${result.filesWritten} file(s) into ${targetDirectory}${installDependencies ? " and ran pnpm install" : ""}`
  );
}
