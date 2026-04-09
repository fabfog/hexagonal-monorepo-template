const baseConfig = require("@repo/config-eslint").default;

module.exports = [
  ...baseConfig,
  {
    ignores: ["**/vitest.config.*.timestamp*"],
  },
];
