export type GeneratorBlueprintFileKind = "template" | "static";

/**
 * One file emitted by a generator run: path is relative to the output root that the use case defines
 * (e.g. `package.json` under `packages/domain/<slug>/`).
 */
export interface GeneratorBlueprintFile {
  relativePath: string;
  kind: GeneratorBlueprintFileKind;
  /** Handlebars body when `kind` is `template`; final bytes when `static`. */
  contents: string;
}

/**
 * Loads blueprint assets from `blueprints/generators/<generatorId>/` (or equivalent).
 */
export interface GeneratorBlueprintSourcePort {
  load(generatorId: string): Promise<GeneratorBlueprintFile[]>;
}
