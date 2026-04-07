const VIOLATION_SEVERITY = process.env.DEPCRUISE_SEVERITY ?? "warn";

module.exports = {
  options: {
    includeOnly: "^packages/",
    exclude: {
      path: "node_modules|\\.pnpm/",
    },
    doNotFollow: {
      path: "node_modules|\\.pnpm/",
    },
    tsConfig: {
      fileName: "tsconfig.repo.json",
    },
    combinedDependencies: false,
  },
  forbidden: [
    {
      name: "global-no-circular",
      comment: "Circular dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-no-cross-context",
      comment: "Forbid feature domain packages importing other domain contexts",
      severity: VIOLATION_SEVERITY,
      from: {
        path: "^packages/domain/([^/]+)/.+",
        pathNot: "^packages/domain/core/.+",
      },
      to: {
        path: "^packages/domain/.+",
        pathNot: ["^packages/domain/core/.+", "^packages/domain/$1/.+"],
      },
    },
    {
      name: "application-no-cross-context",
      comment: "Forbid feature application packages importing other application contexts",
      severity: VIOLATION_SEVERITY,
      from: {
        path: "^packages/application/([^/]+)/.+",
        pathNot: "^packages/application/core/.+",
      },
      to: {
        path: "^packages/application/.+",
        pathNot: ["^packages/application/core/.+", "^packages/application/$1/.+"],
      },
    },
    {
      name: "application-only-same-context-domain",
      comment: "Application packages can import only matching domain context (plus domain/core)",
      severity: VIOLATION_SEVERITY,
      from: { path: "^packages/application/([^/]+)/.+" },
      to: {
        path: "^packages/domain/.+",
        pathNot: ["^packages/domain/core/.+", "^packages/domain/$1/.+"],
      },
    },
    {
      name: "packages-no-importers",
      comment:
        "No other file under packages/ imports this module (static graph). Excludes tests, typings, composition bootstrap, per-folder barrels, and composition-only type shims.",
      severity: VIOLATION_SEVERITY,
      from: {},
      module: {
        path: "^packages/.+\\.(tsx|ts)$",
        pathNot:
          "\\.(test|spec)\\.(tsx|ts)$|\\.d\\.ts$|^packages/composition/[^/]+/src/index\\.(tsx|ts)$|^packages/composition/[^/]+/src/types\\.(tsx|ts)$|/src/[^/]+/index\\.(tsx|ts)$",
        numberOfDependentsLessThan: 1,
      },
    },
  ],
};
