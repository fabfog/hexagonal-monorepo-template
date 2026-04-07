import { pascalCase } from "case-anything";
import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceReaderPort,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { DomainPackageSlug, ValueObjectSlug } from "@domain/dvorark-generators/value-objects";
import type {
  CreateDomainValueObjectInputDto,
  SingleValuePrimitive,
} from "../dto/create-domain-value-object.dto";
import type { GeneratorBlueprintSourcePort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const DOMAIN_VALUE_OBJECT_GENERATOR_ID = "domain-value-object" as const;

const ZOD_RANGE = "^3.23.8";

const primitiveSchemaByType: Record<SingleValuePrimitive, string> = {
  string: "z.string().min(1)",
  boolean: "z.boolean()",
  number: "z.number()",
  Date: "z.date()",
};

const equalsBodyByType: Record<SingleValuePrimitive, string> = {
  string: "return other.value === this.value;",
  boolean: "return other.value === this.value;",
  number: "return other.value === this.value;",
  Date: "return other.value.getTime() === this.value.getTime();",
};

export interface CreateDomainValueObjectUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  workspaceReader: WorkspaceReaderPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
}

export interface CreateDomainValueObjectUseCaseReturn {
  filesWritten: number;
  domainPackageSlug: string;
  valueObjectSlug: string;
  valueObjectKind: CreateDomainValueObjectInputDto["valueObjectKind"];
}

function mergeBarrelExport(
  existing: string | null,
  exportLine: string,
  emptyBarrelPattern: RegExp
): string {
  if (!existing) {
    return `${exportLine}\n`;
  }
  const cleaned = existing.replace(emptyBarrelPattern, "").trimEnd();
  if (cleaned.includes(exportLine)) {
    return `${cleaned}\n`;
  }
  return cleaned.length > 0 ? `${cleaned}\n${exportLine}\n` : `${exportLine}\n`;
}

function patchDomainPackageJson(raw: string): string {
  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    exports?: Record<string, string> | unknown[];
  };
  pkg.dependencies = pkg.dependencies ?? {};
  if (!pkg.dependencies.zod) {
    pkg.dependencies.zod = ZOD_RANGE;
  }
  if (!pkg.exports || typeof pkg.exports !== "object" || Array.isArray(pkg.exports)) {
    pkg.exports = {};
  }
  const exportsObj = pkg.exports as Record<string, string>;
  const key = "./value-objects";
  if (!exportsObj[key]) {
    exportsObj[key] = "./src/value-objects/index.ts";
  }
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export class CreateDomainValueObjectUseCase {
  constructor(private readonly deps: CreateDomainValueObjectUseCaseDependencies) {}

  async execute(
    input: CreateDomainValueObjectInputDto
  ): Promise<CreateDomainValueObjectUseCaseReturn> {
    const domainPkg = DomainPackageSlug.fromString(input.domainPackageSlugInput);
    const voSlug = ValueObjectSlug.fromString(input.valueObjectSlugInput);
    const valueObjectPascal = pascalCase(voSlug.value);
    const kind = input.valueObjectKind;
    const singleValuePrimitive: SingleValuePrimitive = input.singleValuePrimitive ?? "string";

    const templateFiles = await this.deps.generatorBlueprintSource.load(
      DOMAIN_VALUE_OBJECT_GENERATOR_ID
    );
    const byRel = new Map(templateFiles.map((f) => [f.relativePath, f]));

    const templateRel = kind === "composite" ? "vo-composite.ts" : "vo-single-value.ts";
    const tpl = byRel.get(templateRel);
    if (!tpl || tpl.kind !== "template") {
      throw new Error(`Generator "${DOMAIN_VALUE_OBJECT_GENERATOR_ID}" missing ${templateRel}.hbs`);
    }

    const voData: Record<string, string> =
      kind === "composite"
        ? { valueObjectPascal }
        : {
            valueObjectPascal,
            singleValuePrimitive,
            singleValueSchema: primitiveSchemaByType[singleValuePrimitive],
            singleValueEqualsBody: equalsBodyByType[singleValuePrimitive],
          };

    const voContents = await this.deps.templateRenderer.render(tpl.contents, voData);

    const base = `packages/domain/${domainPkg.value}`;
    const pkgJsonRel = `${base}/package.json`;
    const voIndexRel = `${base}/src/value-objects/index.ts`;

    const existingPkgJson = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      pkgJsonRel
    );
    const existingVoIndex = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      voIndexRel
    );

    const exportVo = `export * from './${voSlug.value}.vo';`;
    const emptyExport = /^export\s*{\s*}\s*;?\s*$/m;
    const mergedVoIndex = mergeBarrelExport(existingVoIndex, exportVo, emptyExport);

    const files: WorkspaceFileToWrite[] = [
      {
        relativePath: `${base}/src/value-objects/${voSlug.value}.vo.ts`,
        contents: voContents,
      },
      { relativePath: voIndexRel, contents: mergedVoIndex },
    ];

    if (existingPkgJson) {
      files.push({ relativePath: pkgJsonRel, contents: patchDomainPackageJson(existingPkgJson) });
    }

    await this.deps.workspaceWriter.writeFiles(input.workspaceRoot, files);

    return {
      filesWritten: files.length,
      domainPackageSlug: domainPkg.value,
      valueObjectSlug: voSlug.value,
      valueObjectKind: kind,
    };
  }
}
