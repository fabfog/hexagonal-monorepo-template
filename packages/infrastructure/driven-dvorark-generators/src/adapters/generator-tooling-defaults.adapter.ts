import type { GeneratorToolingDefaultsPort } from "@application/dvorark-generators/ports";
import {
  resolveWorkspaceDependencyRange,
  type WorkspaceToolingDependencyName,
} from "../workspace/resolve-workspace-dependency-range";

async function rangeFor(
  workspaceRoot: string,
  dep: WorkspaceToolingDependencyName
): Promise<string> {
  return resolveWorkspaceDependencyRange(workspaceRoot, dep);
}

export class GeneratorToolingDefaultsAdapter implements GeneratorToolingDefaultsPort {
  async vitestRange(workspaceRoot: string): Promise<string> {
    return rangeFor(workspaceRoot, "vitest");
  }

  async zodRange(workspaceRoot: string): Promise<string> {
    return rangeFor(workspaceRoot, "zod");
  }
}
