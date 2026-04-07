/**
 * Read-only access to workspace files (for generators that merge barrels / package.json).
 */
export interface WorkspaceReaderPort {
  /**
   * @returns file contents, or `null` if the path does not exist
   */
  readTextIfExists(workspaceRoot: string, relativePath: string): Promise<string | null>;
}
