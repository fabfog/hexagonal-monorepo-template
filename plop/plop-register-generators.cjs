const registerDomainPackageGenerator = require("./generators/domain-package.cjs");
const registerDomainEntityZodGenerator = require("./generators/domain-entity-zod.cjs");
const registerDomainValueObjectZodGenerator = require("./generators/domain-value-object-zod.cjs");
const registerDomainErrorGenerator = require("./generators/domain-error.cjs");
const registerDomainServiceGenerator = require("./generators/domain-service.cjs");

const registerApplicationPackageGenerator = require("./generators/application-package.cjs");
const registerApplicationUseCaseGenerator = require("./generators/application-use-case.cjs");
const registerApplicationPortGenerator = require("./generators/application-port.cjs");
const registerApplicationFlowGenerator = require("./generators/application-flow.cjs");
const registerApplicationAddDependencyToUseCaseGenerator = require("./generators/application-add-dependency-to-use-case.cjs");
const registerApplicationAddDependencyToFlowGenerator = require("./generators/application-add-dependency-to-flow.cjs");
const registerApplicationEntityToDtoMapperGenerator = require("./generators/application-entity-to-dto-mapper.cjs");

const registerInfrastructureDrivenAdapterPackageGenerator = require("./generators/infrastructure-driven-adapter-package.cjs");
const registerInfrastructureLibPackageGenerator = require("./generators/infrastructure-lib-package.cjs");
const registerDrivenImmerInteractionAdapterGenerator = require("./generators/driven-immer-interaction-adapter.cjs");
const registerDrivenPortAdapterGenerator = require("./generators/driven-port-adapter.cjs");
const registerDrivenRepositoryAddRepositoryGenerator = require("./generators/driven-repository-add-repository.cjs");
const registerInfrastructureRawToDomainEntityMapperGenerator = require("./generators/infrastructure-raw-to-domain-entity-mapper.cjs");

const registerCompositionPackageGenerator = require("./generators/composition-package.cjs");
const registerCompositionFeatureDependenciesGenerator = require("./generators/composition-feature-dependencies.cjs");
const registerCompositionWireUseCaseGenerator = require("./generators/composition-wire-use-case.cjs");
const registerCompositionWireFlowGenerator = require("./generators/composition-wire-flow.cjs");
const registerCompositionWireInfrastructureGenerator = require("./generators/composition-wire-infrastructure.cjs");
const registerCompositionWireReactCacheDataloaderGenerator = require("./generators/composition-wire-react-cache-dataloader.cjs");

const registerUiPackageGenerator = require("./generators/ui-package.cjs");

/**
 * @param {import('plop').NodePlopAPI} plop
 * @param {string[]} includedLayers
 */
function registerGeneratorsForLayers(plop, includedLayers) {
  if (includedLayers.includes("Domain")) {
    registerDomainPackageGenerator(plop);
    registerDomainEntityZodGenerator(plop);
    registerDomainValueObjectZodGenerator(plop);
    registerDomainErrorGenerator(plop);
    registerDomainServiceGenerator(plop);
  }

  if (includedLayers.includes("Application")) {
    registerApplicationPackageGenerator(plop);
    registerApplicationEntityToDtoMapperGenerator(plop);
    registerApplicationPortGenerator(plop);
    registerApplicationUseCaseGenerator(plop);
    registerApplicationFlowGenerator(plop);
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
    registerCompositionFeatureDependenciesGenerator(plop);
    registerCompositionWireUseCaseGenerator(plop);
    registerCompositionWireFlowGenerator(plop);
    registerCompositionWireInfrastructureGenerator(plop);
    registerCompositionWireReactCacheDataloaderGenerator(plop);
  }

  if (includedLayers.includes("UI")) {
    registerUiPackageGenerator(plop);
  }
}

module.exports = { registerGeneratorsForLayers };
