import type { RequestContext } from "./types.js";
import { infrastructureProvider } from "./infrastructure.js";
import { WorkspaceBootstrapModule } from "@application/dvorark-bootstrap/modules";

export function getDvorarkStudioModules(ctx: RequestContext) {
  const infrastructure = infrastructureProvider.getForContext(ctx);
  return { workspaceBootstrap: new WorkspaceBootstrapModule(infrastructure) };
}
