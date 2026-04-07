export interface WorkspaceInstallPort {
  installDependencies(targetDirectory: string): Promise<void>;
}
