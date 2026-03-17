const registerDomainPackageGenerator = require("./generators/domain-package.cjs");
const registerDomainEntityZodGenerator = require("./generators/domain-entity-zod.cjs");
const registerDomainValueObjectZodGenerator = require("./generators/domain-value-object-zod.cjs");
const registerDomainErrorGenerator = require("./generators/domain-error.cjs");

const registerApplicationPackageGenerator = require("./generators/application-package.cjs");
const registerApplicationUseCaseGenerator = require("./generators/application-use-case.cjs");
const registerApplicationPortGenerator = require("./generators/application-port.cjs");
const registerApplicationFlowGenerator = require("./generators/application-flow.cjs");
const registerApplicationDtoMapperForEntityGenerator = require("./generators/domain-entity-dto-mapper.cjs");

const registerInfrastructureDrivenAdapterGenerator = require("./generators/infrastructure-driven-adapter.cjs");
const registerInfrastructureLibGenerator = require("./generators/infrastructure-lib.cjs");
const registerCompositionPackageGenerator = require("./generators/composition-package.cjs");
const registerCompositionFeatureDependenciesGenerator = require("./generators/composition-feature-dependencies.cjs");

/** @param {import('plop').NodePlopAPI} plop */
module.exports = function (plop) {
  registerDomainPackageGenerator(plop);
  registerDomainEntityZodGenerator(plop);
  registerDomainValueObjectZodGenerator(plop);
  registerDomainErrorGenerator(plop);
  registerApplicationPackageGenerator(plop);
  registerApplicationDtoMapperForEntityGenerator(plop);
  registerApplicationPortGenerator(plop);
  registerApplicationUseCaseGenerator(plop);
  registerApplicationFlowGenerator(plop);
  registerInfrastructureDrivenAdapterGenerator(plop);
  registerInfrastructureLibGenerator(plop);
  registerCompositionPackageGenerator(plop);
  registerCompositionFeatureDependenciesGenerator(plop);
};
