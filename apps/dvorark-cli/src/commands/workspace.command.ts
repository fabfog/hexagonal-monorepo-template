import pc from "picocolors";

import { getDvorarkCliModules } from "@composition/dvorark-cli";

export async function runWorkspaceCommand(): Promise<void> {
  const cwd = process.cwd();
  const { workspaceBootstrap } = getDvorarkCliModules({});
  const result = await workspaceBootstrap.getWorkspaceStatus().execute({
    targetDirectory: cwd,
  });

  if (result.status !== "ready") {
    throw new Error(
      `${pc.bold("No Dvorark workspace")} in ${pc.dim(cwd)}. Run ${pc.cyan("dvorark create <target-directory>")} first.`
    );
  }

  console.log(pc.dim("[dvorark] Workspace mode is not implemented yet."));
}
