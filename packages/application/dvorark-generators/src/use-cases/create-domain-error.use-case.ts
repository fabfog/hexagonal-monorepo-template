import { capitalCase, constantCase, kebabCase, pascalCase } from "case-anything";
import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceReaderPort,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { DomainPackageSlug } from "@domain/dvorark-generators/value-objects";
import {
  domainPackageRootRelative,
  domainSliceIndexRelativePath,
} from "../common-packages-operations/domain";
import { mergeBarrelExport } from "../common-packages-operations/shared";
import type { CreateDomainErrorInputDto } from "../dto/create-domain-error.dto";
import type { GeneratorBlueprintSourcePort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const DOMAIN_ERROR_GENERATOR_ID = "domain-error" as const;

const ENTITY_PASCAL_RE = /^[A-Z][a-zA-Z0-9]*$/;

export interface CreateDomainErrorUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  workspaceReader: WorkspaceReaderPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
}

export interface CreateDomainErrorUseCaseReturn {
  filesWritten: number;
  domainPackageSlug: string;
  errorKind: CreateDomainErrorInputDto["errorKind"];
  /** Kebab stem for `*.error.ts` and barrel (without `.error`). */
  errorFileKebab: string;
}

function assertEntityPascal(name: string): void {
  const t = name.trim();
  if (!ENTITY_PASCAL_RE.test(t)) {
    throw new Error("Entity name must be PascalCase (e.g. User, OrderLine)");
  }
}

export class CreateDomainErrorUseCase {
  constructor(private readonly deps: CreateDomainErrorUseCaseDependencies) {}

  async execute(input: CreateDomainErrorInputDto): Promise<CreateDomainErrorUseCaseReturn> {
    const domainPkg = DomainPackageSlug.fromString(input.domainPackageSlugInput);
    const slug = domainPkg.value;
    const domainRoot = domainPackageRootRelative(slug);
    const errorsIndexRel = domainSliceIndexRelativePath(slug, "errors");

    const templateFiles = await this.deps.generatorBlueprintSource.load(DOMAIN_ERROR_GENERATOR_ID);
    const byRel = new Map(templateFiles.map((f) => [f.relativePath, f]));

    let errorFileKebab: string;
    let errorContents: string;

    if (input.errorKind === "not-found") {
      const entityPascal = input.entityPascalInput?.trim();
      if (!entityPascal) {
        throw new Error("entityPascalInput is required when errorKind is not-found");
      }
      assertEntityPascal(entityPascal);

      errorFileKebab = kebabCase(`${entityPascal}NotFound`);
      const errorFileRel = `${domainRoot}/src/errors/${errorFileKebab}.error.ts`;
      const existingError = await this.deps.workspaceReader.readTextIfExists(
        input.workspaceRoot,
        errorFileRel
      );
      if (existingError !== null) {
        throw new Error(
          `Error file already exists: ${errorFileRel}. Remove it or pick another entity.`
        );
      }

      const tpl = byRel.get("entity-not-found.error.ts");
      if (!tpl || tpl.kind !== "template") {
        throw new Error(
          `Generator "${DOMAIN_ERROR_GENERATOR_ID}" missing entity-not-found.error.ts.hbs`
        );
      }

      const notFoundCodeConstant = constantCase(`${entityPascal}NotFound`);
      errorContents = await this.deps.templateRenderer.render(tpl.contents, {
        entityPascal,
        notFoundCodeConstant,
      });
    } else {
      const rawName = input.customErrorNameInput?.trim();
      if (!rawName) {
        throw new Error("customErrorNameInput is required when errorKind is custom");
      }

      errorFileKebab = kebabCase(rawName);
      const errorFileRel = `${domainRoot}/src/errors/${errorFileKebab}.error.ts`;
      const existingError = await this.deps.workspaceReader.readTextIfExists(
        input.workspaceRoot,
        errorFileRel
      );
      if (existingError !== null) {
        throw new Error(
          `Error file already exists: ${errorFileRel}. Remove it or pick another name.`
        );
      }

      const tpl = byRel.get("custom.error.ts");
      if (!tpl || tpl.kind !== "template") {
        throw new Error(`Generator "${DOMAIN_ERROR_GENERATOR_ID}" missing custom.error.ts.hbs`);
      }

      const errorClassName = `${pascalCase(rawName)}Error`;
      const errorCodeConstant = constantCase(rawName);
      const errorMessageCapital = capitalCase(kebabCase(rawName), { keepSpecialCharacters: false });

      errorContents = await this.deps.templateRenderer.render(tpl.contents, {
        errorClassName,
        errorCodeConstant,
        errorMessageCapital,
      });
    }

    const existingErrorsIndex = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      errorsIndexRel
    );

    const exportLine = `export * from './${errorFileKebab}.error';`;
    const mergedErrorsIndex = mergeBarrelExport(existingErrorsIndex, exportLine);

    const files: WorkspaceFileToWrite[] = [
      {
        relativePath: `${domainRoot}/src/errors/${errorFileKebab}.error.ts`,
        contents: errorContents,
      },
      { relativePath: errorsIndexRel, contents: mergedErrorsIndex },
    ];

    await this.deps.workspaceWriter.writeFiles(input.workspaceRoot, files);

    return {
      filesWritten: files.length,
      domainPackageSlug: slug,
      errorKind: input.errorKind,
      errorFileKebab,
    };
  }
}
