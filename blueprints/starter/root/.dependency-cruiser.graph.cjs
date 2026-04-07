const base = require("./.dependency-cruiser.cjs");

module.exports = {
  ...base,
  options: {
    ...base.options,
    tsPreCompilationDeps: true,
  },
};
