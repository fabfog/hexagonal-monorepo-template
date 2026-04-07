import { getDvorarkCliModules } from "@composition/dvorark-cli";

export async function runWorkspaceCommand(): Promise<void> {
  const cwd = process.cwd();
  const { workspaceBootstrap } = getDvorarkCliModules({});
  const result = await workspaceBootstrap.getWorkspaceStatus().execute({
    targetDirectory: cwd,
  });

  if (result.status !== "ready") {
    throw new Error(
      `No Dvorark workspace found in ${cwd}. Run "dvorark create <target-directory>" first.`
    );
  }

  console.log("[dvorark] Workspace mode is not implemented yet.");
}
