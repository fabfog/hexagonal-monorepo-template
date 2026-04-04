/**
 * dependency-cruiser config (graph + dependency validation)
 *
 * Goals (template):
 * - detect circular dependencies
 * - forbid cross-context imports between domain/app packages
 * - flag package TS with zero importers in the cruised graph (under packages/)
 * - keep severity configurable (default: "warn")
 */

const VIOLATION_SEVERITY = process.env.DEPCRUISE_SEVERITY ?? "warn";

module.exports = {
  options: {
    // We only validate dependencies between domain/application packages.
    includeOnly: "^packages/",
    // Match `node_modules` anywhere (pnpm nests under packages/*/node_modules; `^node_modules` misses that and can crawl forever).
    exclude: {
      path: "node_modules|\\.pnpm/",
    },
    doNotFollow: {
      path: "node_modules|\\.pnpm/",
    },
    // Use repo TS config to help resolution of TS sources/paths.
    tsConfig: {
      fileName: "tsconfig.repo.json",
    },
    combinedDependencies: false,
  },
  forbidden: [
    // ---- cycles ----
    {
      name: "global-no-circular",
      comment: "Circular dependencies",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    // ---- domain context imports ----
    // domain/<ctx> may import:
    // - domain/<ctx> (same context)
    // - domain/core (shared)
    // domain/<ctx> must not import domain/<otherCtx>
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

    // ---- application context imports ----
    // application/<ctx> may import:
    // - application/<ctx> (same context)
    // - application/core (shared)
    // application/<ctx> must not import application/<otherCtx>
    // Note: we intentionally forbid this only when "from" is a feature package.
    // That keeps application/core as an allowed "hub" (it can import feature apps).
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

    // ---- application -> domain imports ----
    // application/<ctx> may import:
    // - domain/<ctx> (same context)
    // - domain/core (shared)
    // application/<ctx> must not import domain/<otherCtx>
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

    // ---- unused within cruised graph (packages/ only) ----
    // Violation: module has fewer than 1 dependent among cruised modules (nothing imports it).
    // Excludes tests, .d.ts, and composition package entries (usually imported only from apps/).
    {
      name: "packages-no-importers",
      comment:
        "No other file under packages/ imports this module (static graph). Excludes tests, typings, composition bootstrap, per-folder barrels (often reached only via package exports from apps), and composition-only type shims (type-only imports may not count as dependents).",
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
