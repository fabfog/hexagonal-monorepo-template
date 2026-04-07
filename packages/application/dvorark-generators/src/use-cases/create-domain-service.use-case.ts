import { kebabCase, pascalCase } from "case-anything";
import type {
  TemplateRendererPort,
  WorkspaceFileToWrite,
  WorkspaceReaderPort,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { DomainPackageSlug } from "@domain/dvorark-generators/value-objects";
import {
  domainPackageJsonRelativePath,
  domainPackageRootRelative,
  domainSliceIndexRelativePath,
} from "../common-packages-operations/domain";
import { mergeBarrelExport, patchPackageJsonExports } from "../common-packages-operations/shared";
import type { CreateDomainServiceInputDto } from "../dto/create-domain-service.dto";
import type { GeneratorBlueprintSourcePort } from "../ports";

/** Blueprint folder under `blueprints/generators/<id>/`. */
export const DOMAIN_SERVICE_GENERATOR_ID = "domain-service" as const;

export interface CreateDomainServiceUseCaseDependencies {
  templateRenderer: TemplateRendererPort;
  workspaceWriter: WorkspaceWriterPort;
  workspaceReader: WorkspaceReaderPort;
  generatorBlueprintSource: GeneratorBlueprintSourcePort;
}

export interface CreateDomainServiceUseCaseReturn {
  filesWritten: number;
  domainPackageSlug: string;
  serviceKebab: string;
}

function stripServiceSuffix(raw: string): string {
  return raw.trim().replace(/Service$/i, "");
}

export class CreateDomainServiceUseCase {
  constructor(private readonly deps: CreateDomainServiceUseCaseDependencies) {}

  async execute(input: CreateDomainServiceInputDto): Promise<CreateDomainServiceUseCaseReturn> {
    const domainPkg = DomainPackageSlug.fromString(input.domainPackageSlugInput);
    const slug = domainPkg.value;
    const domainRoot = domainPackageRootRelative(slug);
    const pkgJsonRel = domainPackageJsonRelativePath(slug);
    const servicesIndexRel = domainSliceIndexRelativePath(slug, "services");

    const selected = input.selectedEntityPascalNames.map((s) => s.trim()).filter(Boolean);
    if (selected.length === 0) {
      throw new Error("Select at least one entity");
    }

    const baseName = stripServiceSuffix(input.serviceNameInput);
    if (!baseName) {
      throw new Error("Service name cannot be empty");
    }

    const serviceKebab = kebabCase(baseName);
    const servicePascal = pascalCase(kebabCase(baseName));

    const serviceFileRel = `${domainRoot}/src/services/${serviceKebab}.service.ts`;
    const existingService = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      serviceFileRel
    );
    if (existingService !== null) {
      throw new Error(
        `Service file already exists: ${serviceFileRel}. Remove it or pick another name.`
      );
    }

    const templateFiles = await this.deps.generatorBlueprintSource.load(
      DOMAIN_SERVICE_GENERATOR_ID
    );
    const tpl = templateFiles.find((f) => f.relativePath === "service.ts");
    if (!tpl || tpl.kind !== "template") {
      throw new Error(`Generator "${DOMAIN_SERVICE_GENERATOR_ID}" missing service.ts.hbs`);
    }

    const entityImportBlock = selected.map((e) => `  ${e}Entity,`).join("\n");

    const serviceContents = await this.deps.templateRenderer.render(tpl.contents, {
      entityImportBlock,
      servicePascal,
    });

    const existingPkgJson = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      pkgJsonRel
    );
    const existingServicesIndex = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      servicesIndexRel
    );

    const exportLine = `export * from './${serviceKebab}.service';`;
    const mergedServicesIndex = mergeBarrelExport(existingServicesIndex, exportLine);

    const files: WorkspaceFileToWrite[] = [
      { relativePath: serviceFileRel, contents: serviceContents },
      { relativePath: servicesIndexRel, contents: mergedServicesIndex },
    ];

    if (existingPkgJson) {
      files.push({
        relativePath: pkgJsonRel,
        contents: patchPackageJsonExports(existingPkgJson, { exportSubpaths: ["services"] }),
      });
    }

    await this.deps.workspaceWriter.writeFiles(input.workspaceRoot, files);

    return {
      filesWritten: files.length,
      domainPackageSlug: slug,
      serviceKebab,
    };
  }
}
