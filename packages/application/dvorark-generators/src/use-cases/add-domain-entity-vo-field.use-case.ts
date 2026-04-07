import { kebabCase } from "case-anything";
import type {
  WorkspaceFileToWrite,
  WorkspaceReaderPort,
  WorkspaceWriterPort,
} from "@application/dvorark-bootstrap/ports";
import { DomainPackageSlug } from "@domain/dvorark-generators/value-objects";
import {
  appendVoFieldToEntitySource,
  domainEntityFileRelativePath,
  domainPackageJsonRelativePath,
} from "../common-packages-operations/domain";
import { patchPackageJsonZodAndOptionalDomainCore } from "../common-packages-operations/shared";
import type { AddDomainEntityVoFieldInputDto } from "../dto/add-domain-entity-vo-field.dto";
import type { GeneratorToolingDefaultsPort } from "../ports";

const PROP_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;

export interface AddDomainEntityVoFieldUseCaseDependencies {
  workspaceReader: WorkspaceReaderPort;
  workspaceWriter: WorkspaceWriterPort;
  generatorToolingDefaults: GeneratorToolingDefaultsPort;
}

export interface AddDomainEntityVoFieldUseCaseReturn {
  filesWritten: number;
  domainPackageSlug: string;
  entityPascal: string;
  propertyName: string;
}

export class AddDomainEntityVoFieldUseCase {
  constructor(private readonly deps: AddDomainEntityVoFieldUseCaseDependencies) {}

  async execute(
    input: AddDomainEntityVoFieldInputDto
  ): Promise<AddDomainEntityVoFieldUseCaseReturn> {
    const domainPkg = DomainPackageSlug.fromString(input.domainPackageSlugInput);
    const prop = input.propertyNameInput.trim();
    if (!PROP_NAME_RE.test(prop)) {
      throw new Error("Property name must be camelCase starting with a lowercase letter.");
    }

    const entityPascal = input.entityPascalInput.trim();
    if (!entityPascal) {
      throw new Error("Entity name is required.");
    }

    const voClass = input.voClass.trim();
    if (!voClass) {
      throw new Error("Value object class name is required.");
    }

    const entityKebab = kebabCase(entityPascal);
    const entityRel = domainEntityFileRelativePath(domainPkg.value, entityKebab);

    const existingEntity = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      entityRel
    );
    if (existingEntity == null) {
      throw new Error(`Entity file not found: ${entityRel}`);
    }

    let patchedEntity: string;
    try {
      patchedEntity = appendVoFieldToEntitySource(existingEntity, entityPascal, {
        prop,
        voClass,
        source: input.voSource,
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      throw new Error(`Could not patch entity: ${err.message}`);
    }

    const files: WorkspaceFileToWrite[] = [{ relativePath: entityRel, contents: patchedEntity }];

    const pkgJsonRel = domainPackageJsonRelativePath(domainPkg.value);
    const existingPkgJson = await this.deps.workspaceReader.readTextIfExists(
      input.workspaceRoot,
      pkgJsonRel
    );

    if (existingPkgJson) {
      const zodRange = await this.deps.generatorToolingDefaults.zodRange(input.workspaceRoot);
      const ensureDomainCore = input.voSource === "core" && domainPkg.value !== "core";
      const mergedPkg = patchPackageJsonZodAndOptionalDomainCore(existingPkgJson, {
        zodRange,
        ensureDomainCore,
      });
      if (mergedPkg !== existingPkgJson) {
        files.push({ relativePath: pkgJsonRel, contents: mergedPkg });
      }
    }

    await this.deps.workspaceWriter.writeFiles(input.workspaceRoot, files);

    return {
      filesWritten: files.length,
      domainPackageSlug: domainPkg.value,
      entityPascal,
      propertyName: prop,
    };
  }
}
