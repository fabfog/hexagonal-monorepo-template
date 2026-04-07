export interface BlueprintSourceFile {
  relativePath: string;
  kind: "static" | "template";
  contents: string;
}

export interface BlueprintSourcePort {
  readStarterBlueprint(): Promise<BlueprintSourceFile[]>;
}
