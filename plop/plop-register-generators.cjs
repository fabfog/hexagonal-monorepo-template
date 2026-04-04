const registerDomainPackageGenerator = require("./generators/domain-package.cjs");
const registerDomainEntityGenerator = require("./generators/domain-entity.cjs");
const registerDomainEntityAddVoFieldGenerator = require("./generators/domain-entity-add-vo-field.cjs");
const registerDomainValueObjectGenerator = require("./generators/domain-value-object.cjs");
const registerDomainErrorGenerator = require("./generators/domain-error.cjs");
const registerDomainServiceGenerator = require("./generators/domain-service.cjs");

const registerApplicationPackageGenerator = require("./generators/application-package.cjs");
const registerApplicationUseCaseGenerator = require("./generators/application-use-case.cjs");
const registerApplicationPortGenerator = require("./generators/application-port.cjs");
const registerApplicationFlowGenerator = require("./generators/application-flow.cjs");
const registerApplicationAddDependencyToUseCaseGenerator = require("./generators/application-add-dependency-to-use-case.cjs");
const registerApplicationAddDependencyToFlowGenerator = require("./generators/application-add-dependency-to-flow.cjs");
const registerApplicationEntityToDtoMapperGenerator = require("./generators/application-entity-to-dto-mapper.cjs");
const registerApplicationModuleGenerator = require("./generators/application-module.cjs");
const registerApplicationWireModuleGenerator = require("./generators/application-wire-module.cjs");

const registerInfrastructureDrivenAdapterPackageGenerator = require("./generators/infrastructure-driven-adapter-package.cjs");
const registerInfrastructureLibPackageGenerator = require("./generators/infrastructure-lib-package.cjs");
const registerDrivenImmerInteractionAdapterGenerator = require("./generators/driven-immer-interaction-adapter.cjs");
const registerDrivenPortAdapterGenerator = require("./generators/driven-port-adapter.cjs");
const registerDrivenRepositoryAddRepositoryGenerator = require("./generators/driven-repository-add-repository.cjs");
const registerInfrastructureRawToDomainEntityMapperGenerator = require("./generators/infrastructure-raw-to-domain-entity-mapper.cjs");

const registerCompositionPackageGenerator = require("./generators/composition-package.cjs");
const registerCompositionWireModuleGenerator = require("./generators/composition-wire-module.cjs");
const registerCompositionWirePortAdapterGenerator = require("./generators/composition-wire-port-adapter.cjs");
const registerUiPackageGenerator = require("./generators/ui-package.cjs");

/**
 * @param {import('plop').NodePlopAPI} plop
 * @param {string[]} includedLayers
 */
function registerGeneratorsForLayers(plop, includedLayers) {
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
    registerCompositionWirePortAdapterGenerator(plop);
  }

  if (includedLayers.includes("UI")) {
    registerUiPackageGenerator(plop);
  }
}

module.exports = { registerGeneratorsForLayers };
