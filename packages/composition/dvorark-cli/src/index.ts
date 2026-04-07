import type { RequestContext } from "./types";
import { infrastructureProvider } from "./infrastructure";
import { WorkspaceBootstrapModule } from "@application/dvorark-bootstrap/modules";
import { DvorarkGeneratorsModule } from "@application/dvorark-generators/modules";
/**
 * Request-scoped application modules: Module classes from each `@application` package (its
 * `modules` entry) that wire use-cases
 * or flows in their constructor. Call this per request (or job) with the same `ctx` you pass
 * through your stack.
 *
 * Example:
 *   import { AuthModule } from "@application/auth/modules";
 *
 *   export function getDvorarkCliModules(ctx: RequestContext) {
 *     const infra = infrastructureProvider.getForContext(ctx);
 *     return {
 *       auth: new AuthModule(infra),
 *     };
 *   }
 */
export function getDvorarkCliModules(ctx: RequestContext) {
  const infrastructure = infrastructureProvider.getForContext(ctx);
  return {
    workspaceBootstrap: new WorkspaceBootstrapModule(infrastructure),
    dvorarkGenerators: new DvorarkGeneratorsModule({
      templateRenderer: infrastructure.templateRenderer,
      workspaceReader: infrastructure.workspaceReader,
      workspaceWriter: infrastructure.workspaceWriter,
      generatorBlueprintSource: infrastructure.generatorBlueprintSource,
      generatorToolingDefaults: infrastructure.generatorToolingDefaults,
    }),
  };
}
