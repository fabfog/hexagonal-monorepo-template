import { kebabCase, pascalCase } from "case-anything";
import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceReaderPort,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { DomainPackageSlug, EntitySlug } from "@domain/dvorark-generators/value-objects";
import type { CreateDomainEntityInputDto } from "../dto/create-domain-entity.dto";
import type { GeneratorBlueprintSourcePort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const DOMAIN_ENTITY_GENERATOR_ID = "domain-entity" as const;

const ZOD_RANGE = "^3.23.8";

export interface CreateDomainEntityUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  workspaceReader: WorkspaceReaderPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
}

export interface CreateDomainEntityUseCaseReturn {
  filesWritten: number;
  domainPackageSlug: string;
  entitySlug: string;
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
  for (const slice of ["entities", "value-objects"] as const) {
    const key = `./${slice}`;
    if (!exportsObj[key]) {
      exportsObj[key] = `./src/${slice}/index.ts`;
    }
  }
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export class CreateDomainEntityUseCase {
  constructor(private readonly deps: CreateDomainEntityUseCaseDependencies) {}

  async execute(input: CreateDomainEntityInputDto): Promise<CreateDomainEntityUseCaseReturn> {
    const domainPkg = DomainPackageSlug.fromString(input.domainPackageSlugInput);
    const entitySlug = EntitySlug.fromString(input.entitySlugInput);
    const entityPascal = pascalCase(entitySlug.value);
    const entityKebab = entitySlug.value;
    const voIdFileKebab = kebabCase(`${entityPascal}Id`);
    const valueObjectPascal = `${entityPascal}Id`;

    const voData: Record<string, string> = {
      valueObjectPascal,
      singleValueSchema: "z.string().min(1)",
      singleValuePrimitive: "string",
      singleValueEqualsBody: "return other.value === this.value;",
    };

    const entityData: Record<string, string> = {
      entityPascal,
      entityKebab,
      voIdFileKebab,
    };

    const templateFiles = await this.deps.generatorBlueprintSource.load(DOMAIN_ENTITY_GENERATOR_ID);
    const byRel = new Map(templateFiles.map((f) => [f.relativePath, f]));

    const entityTpl = byRel.get("entity.entity.ts");
    const testTpl = byRel.get("entity.entity.test.ts");
    const voTpl = byRel.get("entity-id.vo.ts");
    if (!entityTpl || entityTpl.kind !== "template") {
      throw new Error(`Generator "${DOMAIN_ENTITY_GENERATOR_ID}" missing entity.entity.ts.hbs`);
    }
    if (!testTpl || testTpl.kind !== "template") {
      throw new Error(
        `Generator "${DOMAIN_ENTITY_GENERATOR_ID}" missing entity.entity.test.ts.hbs`
      );
    }
    if (!voTpl || voTpl.kind !== "template") {
      throw new Error(`Generator "${DOMAIN_ENTITY_GENERATOR_ID}" missing entity-id.vo.ts.hbs`);
    }

    const entityContents = await this.deps.templateRenderer.render(entityTpl.contents, entityData);
    const testContents = await this.deps.templateRenderer.render(testTpl.contents, entityData);
    const voContents = await this.deps.templateRenderer.render(voTpl.contents, voData);

    const base = `packages/domain/${domainPkg.value}`;
    const pkgJsonRel = `${base}/package.json`;
    const entitiesIndexRel = `${base}/src/entities/index.ts`;
    const voIndexRel = `${base}/src/value-objects/index.ts`;

    const existingPkgJson = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      pkgJsonRel
    );
    const existingEntitiesIndex = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      entitiesIndexRel
    );
    const existingVoIndex = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      voIndexRel
    );

    const exportEntity = `export * from './${entityKebab}.entity';`;
    const exportVo = `export * from './${voIdFileKebab}.vo';`;
    const emptyExport = /^export\s*{\s*}\s*;?\s*$/m;

    const mergedEntitiesIndex = mergeBarrelExport(existingEntitiesIndex, exportEntity, emptyExport);
    const mergedVoIndex = mergeBarrelExport(existingVoIndex, exportVo, emptyExport);

    const files: WorkspaceFileToWrite[] = [
      {
        relativePath: `${base}/src/value-objects/${voIdFileKebab}.vo.ts`,
        contents: voContents,
      },
      {
        relativePath: `${base}/src/entities/${entityKebab}.entity.ts`,
        contents: entityContents,
      },
      {
        relativePath: `${base}/src/entities/${entityKebab}.entity.test.ts`,
        contents: testContents,
      },
      { relativePath: entitiesIndexRel, contents: mergedEntitiesIndex },
      { relativePath: voIndexRel, contents: mergedVoIndex },
    ];

    if (existingPkgJson) {
      files.push({ relativePath: pkgJsonRel, contents: patchDomainPackageJson(existingPkgJson) });
    }

    await this.deps.workspaceWriter.writeFiles(input.workspaceRoot, files);

    return {
      filesWritten: files.length,
      domainPackageSlug: domainPkg.value,
      entitySlug: entitySlug.value,
    };
  }
}
