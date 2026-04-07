## dvorark

pnpm-based monorepo designed for a hexagonal architecture (Domain / Application / Infrastructure / UI) with shared configuration for TypeScript, ESLint, and Prettier.

### Requirements

- Node.js >=22, <23
- pnpm 9.x

### Setup

```bash
pnpm install
```

### Dependency updates (Renovate)

[Renovate](https://github.com/renovatebot/renovate) opens PRs/MRs to keep npm dependencies and `pnpm-lock.yaml` current. This repo includes a root [`renovate.json`](./renovate.json) tuned for a **pnpm workspace** (single lockfile, all packages discovered automatically).

**Enable it on your forge** (same config file everywhere):

- **GitHub**: [Renovate GitHub App](https://github.com/apps/renovate)
- **GitLab**: [Renovate for GitLab](https://docs.renovatebot.com/modules/platform/gitlab/)
- **Bitbucket** (Cloud / Server): [Bitbucket](https://docs.renovatebot.com/modules/platform/bitbucket/) · [Bitbucket Server](https://docs.renovatebot.com/modules/platform/bitbucket-server/)
- **Other / air-gapped**: [self-hosted](https://docs.renovatebot.com/getting-started/running/) (Docker, CLI, or pipeline job) with the same `renovate.json`

Optional: validate config locally with `npx -p renovate renovate-config-validator renovate.json` (downloads the `renovate` package on first run).

### Root scripts

- `pnpm lint` – Run ESLint on the whole monorepo (with architectural constraints)
- `pnpm lint:fix` – ESLint with auto-fix where possible
- `pnpm format` – Format the whole codebase with Prettier
- `pnpm format:check` – Check formatting without modifying files
- `pnpm test` – Run the Vitest suite
- `pnpm test:watch` – Run Vitest in watch mode
- `pnpm test:coverage` – Run Vitest with V8 coverage
- `pnpm deps:renovate` – Validate `renovate.json` locally
- `pnpm deps:lint` – Enforce dependency rules with dependency-cruiser (see `.dependency-cruiser.cjs`)
- `pnpm deps:graph` – Open **package-level** graph as Mermaid HTML (colors by layer under `packages/`). Also writes `packages.mmd`, `packages.dot`, and `packages-graph.json` under `depcruiser-reports/` (gitignored). Infrastructure packages are included as graph nodes even when they are only lightly connected. With Graphviz `dot` on `PATH`, `packages.svg` is generated too.
- `pnpm deps:graph:composition` – Open **composition wiring (overview)** as Mermaid HTML: `apps/*/src` → `@composition/*` → `@application/*` → **`src/modules/*.module.ts` only** (stops at modules for readability). Also writes `composition-wiring.mmd`, `composition-wiring.dot`, and `composition-wiring.json` under `depcruiser-reports/`. With Graphviz `dot` on `PATH`, `composition-wiring.svg` is generated too. Pass **`--full`** to embed use-cases, flows, imported application ports, and domain in the same graph (dense layout): `pnpm deps:graph:composition -- --full`.
- `pnpm deps:graph:module -- packages/application/<pkg>/src/modules/<name>.module.ts` – **Drill-down** for one module: module → wired use-cases & flows (from `*.module.ts` patterns) → imported application ports and domain imports in those files (same rules as the full composition graph). You can also pass the **composition-graph label** `<pkg>/<name>.module` (e.g. `demo-support/knowledge-base.module`). Opens Mermaid HTML and writes `module-wiring-<pkg>-<name>.{html,mmd,dot,json}` under `depcruiser-reports/`.
- `pnpm demo:generate` – Generate an **expanded** demo stack via Plop (multiple domain entities/services, several modules, **three** `@composition/*` roots, and `apps/demo-stack-shell` importing all three) so you can stress-test `pnpm deps:graph:composition` / `pnpm deps:graph`. Runs `pnpm install` with confirmation enabled; update the lockfile if your environment uses a frozen lockfile policy.
- `pnpm demo:remove` – Remove demo packages and `apps/demo-stack-shell` created by `pnpm demo:generate`

---

## Monorepo structure

The pnpm workspace is defined in `pnpm-workspace.yaml` and separates:

- business code (`packages/*`)
- concrete apps (`apps/*`; the demo generator adds `apps/demo-stack-shell` as a composition-import probe)
- shared configuration (`configs/*`)

### `packages/` folder

This is where packages with **domain / application / infrastructure code** live, not tooling-only packages.

- **`packages/domain/*`**
  - Example: `packages/domain/core` (`@domain/core`)
  - Should contain:
    - Domain entities, business logic, validation schemas, domain errors.
  - Should _not_ contain:
    - DB/API access, orchestration of use cases, UI / view code (React, Nest controllers, etc.).

- **`packages/application/*`**
  - Example: `packages/application/core` (`@application/core`)
  - Should contain:
    - Use cases, Ports, DTOs, mappers (Domain ↔ DTO), application-level error handling.
  - Should _not_ contain:
    - Infrastructure details (HTTP clients, CMS/DB SDKs, UI state stores), View code.

- **Domain & application imports**  
  Subpath exports only (each package’s `package.json` `exports`); no root `"."` barrel. Examples: `@domain/core/errors`, `@domain/<pkg>/entities`, `@application/<pkg>/ports`, `@application/<pkg>/dtos`, `@application/<pkg>/mappers`.

- **`packages/infrastructure/*`**
  - Reusable driving adapters (e.g. HTTP controllers, CLI entrypoints, UI components that call use cases).
  - Driven adapters (e.g. repositories to DB/CMS, InteractionPort adapters, external clients).
  - Infrastructure libraries (`@infrastructure/lib-*`) reused by other Infrastructure packages (e.g. reactive stores, HTTP clients, logging utilities).
    - Example: `@infrastructure/lib-react-immer-store`, a small library that provides:
      - an `ExternalStore<T>` primitive (`createImmerStore`) implemented with Immer (no React dependency) that exposes `getSnapshot`, `getState`, `subscribe`, `update`, and `setState`;
      - a React hook (`useImmerStore`) that turns any `ExternalStore<T>` into a VAI-friendly view accessor via `useSyncExternalStore`.
    - In the VAI pattern this sits between **Application** and **UI** as a reusable technical detail: InteractionPort adapters in the FE can depend on it to manage state, while Domain/Application remain unaware of React/Immer.

- **`packages/composition/*`**
  - Example: `packages/composition/web` (`@composition/web`)
  - **Purpose**: Composition packages are the **dependency-injection / wiring layer** for one or more apps or surfaces. They:
    - Instantiate use cases, flows, and infrastructure adapters and expose them as a single `dependencies` object (optionally grouped by feature, with lazy loading).
    - Act as the only place that knows how to assemble domain, application, and infrastructure; apps then depend only on composition (and application DTOs), not on use cases or flows directly.
  - They have a single entry point (`src/index.ts`) and may import from domain, application, and infrastructure.
  - For a **different wiring surface** (e.g. browser bundle vs Node server), use **another** `@composition/*` package instead of multiple runtime subfolders inside one package.
  - Per-request concerns (e.g. a `DataLoaderRegistry` per HTTP request via React `cache`, `AsyncLocalStorage`, or your stack’s equivalent) are **not** scaffolded by Plop; implement or document them in your app / examples as needed.
  - They must _not_ import from `apps/*`.

- **`packages/ui/*`**
  - View-facing UI packages (components, screens) scoped as `@ui/<name>` (e.g. `packages/ui/react` → `@ui/react`).
  - May depend on **composition only**; must not import domain, application (including DTOs), or infrastructure directly (see ESLint `boundaries`). Data reaches UI via the composition layer.

- **`apps/*`**
  - Next.js, Nest, or other runnable apps.
  - Apps may import only from `@composition/*` and from application DTOs (e.g. `@application/<name>`’s `dtos`). All other layers (domain, use-cases, flows, infrastructure) are forbidden so that composition is the single wiring layer.

Every package in `packages/*` is a pnpm workspace with its own `package.json`, `tsconfig.json`, and `src/`.

### `configs/` folder

This is where **shared configuration packages** live, used by other packages/apps but containing no domain logic.

- **`configs/config-typescript`** (`@repo/config-typescript`)
  - Contains:
    - TS preset `base.json` with common options: target, strictness, `noEmit`, etc.
  - Typical usage: extended by `tsconfig.repo.json` at the root, which is then extended by packages/apps.

- **`configs/config-eslint`** (`@repo/config-eslint`)
  - Contains:
    - ESLint flat config (v9) with:
      - `@eslint/js` + `typescript-eslint` (base + stylistic rules)
      - `eslint-plugin-boundaries` for architectural constraints
      - TypeScript resolver (`eslint-import-resolver-typescript`) configured against `tsconfig.repo.json`
    - Architectural rules enabled via `boundaries/dependencies` (e.g. domain must not import application/infrastructure; **`packages/infrastructure/driven-*` (non-repository) may import domain only under `src/errors` and `src/value-objects`**; **`driven-repository-*` may also import `src/entities`**, not domain services).
  - It is consumed by `eslint.config.cjs` at the root of the monorepo.

- **`configs/config-vitest`** (`@repo/config-vitest`)
  - Contains:
    - a shared Vitest helper exported from `src/base.cjs` (`defineBaseVitestConfig`)
    - default test settings such as `environment: "node"` and `include: ["packages/**/*.test.ts"]`
  - It can be imported by packages/apps that want a shared Vitest baseline with local overrides.

Other config packages that can live here in the future:

- `config-prettier`
- `config-jest`
- `config-stylelint`

---

## TypeScript configuration

The global TS configuration lives in `tsconfig.repo.json` and is meant to:

- avoid `.js` file extensions in imports
- allow NestJS or other Node/FE apps to compile package sources directly

The shared base options live in `configs/config-typescript/base.json`, while `tsconfig.repo.json` adds repo-level overrides such as `baseUrl`, `module: "ESNext"`, and `moduleResolution: "bundler"`.

Each package defines its own `tsconfig.json` extending `tsconfig.repo.json`.

---

## ESLint configuration

The main ESLint config lives in `configs/config-eslint` and is exposed from the root via `eslint.config.cjs`:

Key aspects of the shared config:

- uses `@eslint/js` + `typescript-eslint` (flat config)
- defines architectural layers via `eslint-plugin-boundaries`
- `eslint-plugin-boundaries`: layers are split into **explicit element types** (no broad `application` / `domain` / `infrastructure` catch-alls): e.g. **`application-dtos`**, **`application-use-cases`**, **`application-flows`**, **`application-modules`**, **`application-interaction-ports`** (`*.interaction.port.*`), **`application-ports`**, **`application-mappers`**, **`application-other`**; **`domain-errors`**, **`domain-value-objects`**, **`domain-entities`**, **`domain-services`**, **`domain-utils`**, **`domain-other`**; **`infrastructure-driven-repository`**, **`infrastructure-driven`**, **`infrastructure-lib`**, **`infrastructure-other`**. Key boundary rules:
  - **Domain** must not import anything above itself (no application / infrastructure / composition / UI / apps).
  - **Application orchestration** (`use-cases`, `flows`, `modules`) must not import each other; they are independent and composed externally. `mappers` are logic (not orchestration) and may be imported by use-cases/flows.
  - **Infrastructure** must not import application logic (`use-cases`, `flows`, `modules`, `mappers`); driven-repository adapters may import domain entities; non-repository driven adapters are limited to domain errors and value-objects.
  - **Composition** may import anything except `apps` and `ui`; it is the only place that wires modules.
  - **Apps** may import only `@composition/*`, **`application-dtos`** (use-case result shapes) and **`application-interaction-ports`** (`*.interaction.port.*` files — `InteractionPort` types needed by UI-driven flows); plain ports, orchestration, and all other application/domain/infrastructure layers are forbidden.
  - **UI** must not import any application slice (including DTOs), domain, or infrastructure; all data flows in through composition.

### Lint scripts

- **Root**:
  - `pnpm lint` – ESLint on the whole monorepo (`.`)
  - `pnpm lint:fix` – ESLint with fixes
- **Packages** (e.g. `@domain/core`, `@application/core`):
  - `pnpm -C packages/domain/core lint`
  - `pnpm -C packages/domain/core lint:fix`

Thanks to the root `eslint.config.cjs`, you don’t need a separate ESLint config per package unless you need overrides.

---

## Code generators (Plop)

This repo uses [Plop](https://plopjs.com) to generate domain, application, infrastructure, and composition artifacts following the hexagonal conventions.

- **How to run**

  ```bash
  pnpm plop
  ```

- **Skip the layer menu (scripts, CI, tests):** set `PLOP_LAYER` to `All` or to one layer (`Domain`, `Application`, `Infrastructure`, `Composition`, `UI`), or pass `--plop-layer=…` after `--` so pnpm forwards it, e.g. `pnpm plop -- --plop-layer All`. Invalid values throw at startup.

- **Shared Plop utilities** (`plop/lib/`): `index.cjs` re-exports **casing** (`plop/lib/casing.cjs`: `toKebabCase`, `toPascalCase`, `toCamelCase`, `lowerFirst`, `toConstantCase`, `parseInterfaceMethods`) and **packages** (`plop/lib/packages.cjs`: listing workspace packages, Plop `choices`, port/entity/flow/use-case discovery, `packageJsonPath`, `readApplicationPortSource`, `ensureZodDependencyInDomainPackage`, etc.). Generators import from `../lib` (resolved via `plop/lib/package.json`).

- **Available generators** (match the names in the Plop menu):

  | Generator                                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
  | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Domain**                                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | `domain-package`                             | Create a new `@domain/<name>` package with `entities`, `value-objects`, `errors`, `services` and `package.json` subpath exports (no root `src/index.ts` barrel).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
  | `domain-entity`                              | Add an Entity (schema + type + class in one file) to an existing domain package; updates entities barrel. Use `domain-entity-add-vo-field` for VO-backed props.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | `domain-entity-add-vo-field`                 | Add **one** VO-backed property to an existing `*.entity.ts` (pick entity + camelCase prop + VO class). Run again for more fields. VOs from `@domain/core/value-objects` or the package’s `value-objects`; adds `@domain/core` when the chosen VO is from core.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
  | `domain-value-object`                        | Add a Value Object (schema + type + class with `equals`) to an existing domain package (**including `@domain/core`**); updates value-objects barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
  | `domain-error`                               | Add a `DomainError` subclass to a domain package (including `core`); updates errors barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | `domain-service`                             | Add a domain service in `src/services`: pick domain package + one or more entities, name the capability (specific, not `UserService`); generates `XxxService` with `execute`, `XxxServiceInput` / `XxxServiceOutput`, imports selected entities from `../entities`, updates services barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | **Application**                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | `application-package`                        | Create a new `@application/<name>` package with `ports`, `use-cases`, `flows`, `dtos`, `mappers` and `package.json` subpath exports (no root `src/index.ts` barrel).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
  | `application-use-case`                       | Add a `XxxUseCase` class to an existing application package (excludes `core`), generate a `*.use-case.test.ts` file, and update the use-cases barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
  | `application-port`                           | Add a port interface to an existing application package (excludes `core`), supporting both normal `Port` and `InteractionPort`, and update the ports barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | `application-flow`                           | Add a `XxxFlow` and its `XxxInteractionPort` to an application package, generate a `*.flow.test.ts` file, and update flows/ports barrels.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
  | `application-module`                         | Create `src/modules/` (and `./modules` export) on first use, add `src/modules/<kebab>.module.ts` with `XxxInfra` + `XxxModule`. Optional checkboxes wire use-cases/flows via the TypeScript AST (merged Infra props, `import type` from wired files, `new …({ … infra })`), or leave both empty for a commented skeleton. Appends `export *` to `src/modules/index.ts`.                                                                                                                                                                                                                                                                                                                                                                             |
  | `application-wire-module`                    | Pick an existing `*.module.ts`, then checkbox additional use-cases/flows to wire incrementally (skips slices already exposed as `public readonly …: …UseCase` / `…Flow`). Updates imports, `XxxInfra`, fields, and constructor; removes a bare `void infra;` when real assignments are added.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | `application-entity-to-dto-mapper`           | Given a domain entity, create DTO + mapper + `*.mapper.test.ts` in the corresponding application package (or pick another existing app package if auto-create is disabled), update dtos/mappers barrels, add `@domain/<pkg>` dependency, and ensure `vitest` + `test` script if missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | **Infrastructure**                           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | `infrastructure-driven-adapter-package`      | Create a new `@infrastructure/driven-<name>` or `@infrastructure/driven-repository-<name>` package (prompt: repository adapter or not), `package.json`, `tsconfig.json`, `src/index.ts`. Do not put “repository” in the capability name; use the prompt instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
  | `infrastructure-lib-package`                 | Create a new `@infrastructure/lib-<name>` package (infrastructure “library” code such as reusable utilities) under `packages/infrastructure` with `package.json`, `tsconfig.json`, and a single entry point `src/index.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
  | `driven-port-adapter`                        | Generate or **merge** a concrete adapter for a normal application `Port` in a `driven-*` package: creates `src/adapters/*.adapter.ts` if missing; if the file exists, appends stub methods only for Port methods not yet present (does not overwrite existing methods). Updates adapters/index, package index, and `@application/<pkg>` dependency if missing.                                                                                                                                                                                                                                                                                                                                                                                      |
  | `driven-immer-interaction-adapter`           | Generate or **merge** an Immer-based `InteractionPort` adapter under `src/interaction-adapters/`: if the file exists, **only appends** methods missing from the class (same adapter base name + port as when created). Prompt: **checkbox** of `Promise<…>` port methods to implement with the ask pattern (`currentInteraction`, `type` = method name); others get the usual `Not implemented` stub. Adds `currentInteraction` on state when any ask method exists or is merged. Re-runs do **not** rewrite existing method bodies (change ask/stub by editing the file).                                                                                                                                                                          |
  | `infrastructure-raw-to-domain-entity-mapper` | Generate a raw-to-domain-entity mapper scaffold + `*.mapper.test.ts` in any infrastructure package: selects domain package/entity + raw type name, creates mapper under `src/mappers`, updates mappers/index and package index, and adds `@domain/<pkg>` + `vitest` (and `test` script) if missing.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
  | **Composition**                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | `composition-package`                        | Create a new `@composition/<name>`: `package.json` (root export → `./src/index.ts`), `tsconfig.json`, and `src/types.ts` (`RequestContext`), `src/infrastructure.ts` (private `*InfrastructureProvider` + `infrastructureProvider`), `src/index.ts` exports `get<PascalCaseName>Modules(ctx)` (stub body: `infrastructureProvider.getForContext(ctx)` + empty `return {}`; **does not** re-export `infrastructureProvider`). Wire application modules inside that factory. `RequestContext` is composition-local; map it to HTTP / SDK concerns inside `src/infrastructure.ts`.                                                                                                                                                                     |
  | `composition-wire-module`                    | Pick a composition package and an application `*.module.ts`: adds `import { …Module } from "@application/<pkg>/modules"`, adds `@application/<pkg>` to the composition `package.json` if missing, and appends `<camelKey>: new …Module(<infraVar>)` to the `return` of `get*Modules` (detects the variable assigned from `infrastructureProvider.getForContext(ctx)`). Does **not** extend `getForContext` / Infra types—those stay manual.                                                                                                                                                                                                                                                                                                         |
  | `composition-wire-http-client`               | Wire a **request-scoped** `httpClient` (or custom camelCase name) into `src/infrastructure.ts` using `@infrastructure/lib-http`: adds imports, inserts `private getHttpClient(ctx)` with `createHttpClientForContext(...)`, appends the property to `getForContext(ctx)`, and adds `@infrastructure/lib-http` to the composition `package.json`. Leaves a focused `FIXME` for real `prefixUrl` / auth / extra header mapping from `RequestContext`.                                                                                                                                                                                                                                                                                                 |
  | `composition-wire-dataloader-registry`       | Wire a **request-scoped** `loaders` registry (or custom camelCase name) into `src/infrastructure.ts` using `@infrastructure/lib-dataloader`: adds imports, inserts `private getLoaders(ctx)` returning `createDataLoaderRegistry()`, appends the property to `getForContext(ctx)`, and adds `@infrastructure/lib-dataloader` to the composition `package.json`. Uses request-scoped cache by default; does **not** wire idle logic.                                                                                                                                                                                                                                                                                                                 |
  | `composition-wire-port-adapter`              | Pick composition + infrastructure package + exported class that `implements` a `*Port` / `*InteractionPort`: adds `import type` for the port (from the adapter file’s imports), imports the adapter from `@infrastructure/<pkg>`, updates `package.json` with workspace deps (`@infrastructure/…` and `@application/…` when the port type comes from application). Prompts for **camelCase** Infra property name and **app-scoped** (`private readonly … = new …()`) vs **request-scoped** (`private get…(ctx)` + `getForContext` return). If the adapter constructor has required parameters, emits `// FIXME` + `new Adapter()` (app: field initializer; request: return) so TypeScript keeps reporting the arity error until you wire real deps. |
  | **UI**                                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | `ui-package`                                 | Create a new `@ui/<name>` package under `packages/ui/<name>` (e.g. `react` → `packages/ui/react`), with `package.json`, `tsconfig.json`, and `src/index.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Generators are intentionally minimal: they create the right folders, barrels, and base classes/interfaces, but leave TODOs where business logic or mapping must be implemented explicitly.

For infrastructure wiring:

- `@infrastructure/lib-http` is optional. Use it when an adapter needs outbound HTTP concerns such as correlation/header propagation. Adapters built on third-party SDKs can ignore it entirely.
- `HttpContext` is data-only and stays independent from `RequestContext`; composition is responsible for translating between them.
- `@infrastructure/lib-dataloader` defaults to `createDataLoaderRegistry()` request-scoped caches. `createIdleDataLoader()` remains available only as an explicit opt-in helper for long-lived runtimes.
