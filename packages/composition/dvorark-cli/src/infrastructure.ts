import type { RequestContext } from "./types";
import {
  BlueprintSourceAdapter,
  TemplateRendererAdapter,
  WorkspaceInspectionAdapter,
  WorkspaceInstallAdapter,
  WorkspaceTargetAdapter,
  WorkspaceWriterAdapter,
} from "@infrastructure/driven-dvorark-bootstrap";
import {
  GeneratorBlueprintSourceAdapter,
  GeneratorToolingDefaultsAdapter,
} from "@infrastructure/driven-dvorark-generators";

/**
 * Wires driven adapters and exposes a single object for application modules.
 *
 * **App-scoped dependencies** (one instance for the whole process / app lifetime):
 * - Hold them as ordinary private fields, or
 * - Lazily construct them with a private backing field and a getter that uses nullish
 *   coalescing assignment, e.g. `private _client: Foo | null = null` and
 *   `private get client() { return (this._client ??= new FooAdapter(...)); }`
 *
 * **Request-scoped dependencies** (must vary per HTTP request / correlation / tenant):
 * - Do not cache them on `this` as long-lived singletons. Instead, add methods that take
 *   `RequestContext` and return a fresh or context-bound instance, e.g.
 *   `getHttpClient(ctx: RequestContext)`, `getLoaders(ctx)`, or
 *   `getTicketRepository(ctx: RequestContext) { return new SqlTicketRepository(...); }`
 *
 * **`getForContext(ctx)`** should assemble the slice your modules need by combining
 * app-scoped ports (from your private getters / fields) with request-scoped ones (by calling
 * those `get…(ctx)` methods and passing the same `ctx`). Return one object (or a typed
 * interface) that modules receive in their constructor.
 */
class DvorarkCliInfrastructureProvider {
  private readonly blueprintSource = new BlueprintSourceAdapter();
  private readonly templateRenderer = new TemplateRendererAdapter();
  private readonly workspaceWriter = new WorkspaceWriterAdapter();
  private readonly workspaceInstall = new WorkspaceInstallAdapter();
  private readonly workspaceTarget = new WorkspaceTargetAdapter();
  private readonly workspaceInspection = new WorkspaceInspectionAdapter();
  private readonly generatorBlueprintSource = new GeneratorBlueprintSourceAdapter();
  private readonly generatorToolingDefaults = new GeneratorToolingDefaultsAdapter();

  getForContext(_ctx: RequestContext) {
    return {
      blueprintSource: this.blueprintSource,
      templateRenderer: this.templateRenderer,
      workspaceWriter: this.workspaceWriter,
      workspaceInstall: this.workspaceInstall,
      workspaceTarget: this.workspaceTarget,
      workspaceInspection: this.workspaceInspection,
      generatorBlueprintSource: this.generatorBlueprintSource,
      generatorToolingDefaults: this.generatorToolingDefaults,
    };
  }
}

export const infrastructureProvider = new DvorarkCliInfrastructureProvider();
