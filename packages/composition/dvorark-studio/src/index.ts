import type { RequestContext } from "./types.js";
import { infrastructureProvider } from "./infrastructure.js";
import { WorkspaceBootstrapModule } from "@application/dvorark-bootstrap/modules";
import { DvorarkGeneratorsModule } from "@application/dvorark-generators/modules";

export function getDvorarkStudioModules(ctx: RequestContext) {
  const infrastructure = infrastructureProvider.getForContext(ctx);
  return {
    workspaceBootstrap: new WorkspaceBootstrapModule(infrastructure),
    dvorarkGenerators: new DvorarkGeneratorsModule({
      templateRenderer: infrastructure.templateRenderer,
      workspaceWriter: infrastructure.workspaceWriter,
      generatorBlueprintSource: infrastructure.generatorBlueprintSource,
      generatorToolingDefaults: infrastructure.generatorToolingDefaults,
    }),
  };
}
