import type { NodePlopAPI } from "node-plop";
import type { PlopLayer } from "./plop-resolve-layers.ts";
import registerDomainPackageGenerator from "./generators/domain-package.ts";
import registerDomainEntityGenerator from "./generators/domain-entity.ts";
import registerDomainEntityAddVoFieldGenerator from "./generators/domain-entity-add-vo-field.ts";
import registerDomainValueObjectGenerator from "./generators/domain-value-object.ts";
import registerDomainErrorGenerator from "./generators/domain-error.ts";
import registerDomainServiceGenerator from "./generators/domain-service.ts";
import registerApplicationPackageGenerator from "./generators/application-package.ts";
import registerApplicationUseCaseGenerator from "./generators/application-use-case.ts";
import registerApplicationPortGenerator from "./generators/application-port.ts";
import registerApplicationFlowGenerator from "./generators/application-flow.ts";
import registerApplicationAddDependencyToUseCaseGenerator from "./generators/application-add-dependency-to-use-case.ts";
import registerApplicationAddDependencyToFlowGenerator from "./generators/application-add-dependency-to-flow.ts";
import registerApplicationEntityToDtoMapperGenerator from "./generators/application-entity-to-dto-mapper.ts";
import registerApplicationModuleGenerator from "./generators/application-module.ts";
import registerApplicationWireModuleGenerator from "./generators/application-wire-module.ts";
import registerInfrastructureDrivenAdapterPackageGenerator from "./generators/infrastructure-driven-adapter-package.ts";
import registerInfrastructureLibPackageGenerator from "./generators/infrastructure-lib-package.ts";
import registerDrivenImmerInteractionAdapterGenerator from "./generators/driven-immer-interaction-adapter.ts";
import registerDrivenPortAdapterGenerator from "./generators/driven-port-adapter.ts";
import registerDrivenRepositoryAddRepositoryGenerator from "./generators/driven-repository-add-repository.ts";
import registerInfrastructureRawToDomainEntityMapperGenerator from "./generators/infrastructure-raw-to-domain-entity-mapper.ts";
import registerCompositionPackageGenerator from "./generators/composition-package.ts";
import registerCompositionWireModuleGenerator from "./generators/composition-wire-module.ts";
import registerCompositionWireHttpClientGenerator from "./generators/composition-wire-http-client.ts";
import registerCompositionWireDataLoaderRegistryGenerator from "./generators/composition-wire-dataloader-registry.ts";
import registerCompositionWirePortAdapterGenerator from "./generators/composition-wire-port-adapter.ts";
import registerUiPackageGenerator from "./generators/ui-package.ts";
function registerGeneratorsForLayers(plop: NodePlopAPI, includedLayers: PlopLayer[]) {
  if (includedLayers.includes("Domain")) {
    registerDomainPackageGenerator(plop);
    registerDomainEntityGenerator(plop);
    registerDomainEntityAddVoFieldGenerator(plop);
    registerDomainValueObjectGenerator(plop);
    registerDomainErrorGenerator(plop);
    registerDomainServiceGenerator(plop);
  }
  if (includedLayers.includes("Application")) {
    registerApplicationPackageGenerator(plop);
    registerApplicationEntityToDtoMapperGenerator(plop);
    registerApplicationPortGenerator(plop);
    registerApplicationUseCaseGenerator(plop);
    registerApplicationFlowGenerator(plop);
    registerApplicationModuleGenerator(plop);
    registerApplicationWireModuleGenerator(plop);
    registerApplicationAddDependencyToUseCaseGenerator(plop);
    registerApplicationAddDependencyToFlowGenerator(plop);
  }
  if (includedLayers.includes("Infrastructure")) {
    registerInfrastructureDrivenAdapterPackageGenerator(plop);
    registerInfrastructureLibPackageGenerator(plop);
    registerDrivenPortAdapterGenerator(plop);
    registerDrivenRepositoryAddRepositoryGenerator(plop);
    registerDrivenImmerInteractionAdapterGenerator(plop);
    registerInfrastructureRawToDomainEntityMapperGenerator(plop);
  }
  if (includedLayers.includes("Composition")) {
    registerCompositionPackageGenerator(plop);
    registerCompositionWireModuleGenerator(plop);
    registerCompositionWireHttpClientGenerator(plop);
    registerCompositionWireDataLoaderRegistryGenerator(plop);
    registerCompositionWirePortAdapterGenerator(plop);
  }
  if (includedLayers.includes("UI")) {
    registerUiPackageGenerator(plop);
  }
}
export { registerGeneratorsForLayers };
