const { logger } = require("@nx/devkit");

/**
 * Placeholder generator to verify the local plugin is wired; replace with real generators over time.
 * @param {import('@nx/devkit').Tree} tree
 * @param {{ message?: string }} schema
 */
async function helloGenerator(_tree, schema) {
  const message = schema.message ?? "nx";
  logger.info(`@repo/nx-plugin:hello — ${message}`);
}

module.exports = { helloGenerator };
