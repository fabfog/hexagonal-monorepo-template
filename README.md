## hexagonal-monorepo-template

pnpm-based monorepo designed for a hexagonal architecture (Domain / Application / Infrastructure / UI) with shared configuration for TypeScript, ESLint, and Prettier.

### Requirements

- Node.js >=22, <23
- pnpm 9.x

### Setup

```bash
pnpm install
```

### Root scripts

- `pnpm lint` – Run ESLint on the whole monorepo (with architectural constraints)
- `pnpm lint:fix` – ESLint with auto-fix where possible
- `pnpm format` – Format the whole codebase with Prettier
- `pnpm format:check` – Check formatting without modifying files

---

## Monorepo structure

The pnpm workspace is defined in `pnpm-workspace.yaml` and separates:

- business code (`packages/*`)
- concrete apps (`apps/*`, to be added)
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
  - They must _not_ import from `apps/*`.

- **`packages/ui/*`**
  - View-facing UI packages (components, screens) scoped as `@ui/<name>` (e.g. `packages/ui/react` → `@ui/react`).
  - May depend on application DTOs and composition; must not import domain, use-cases, flows, or infrastructure directly (see ESLint `boundaries`).

- **`apps/*`**
  - Next.js, Nest, or other runnable apps.
  - Apps may import only from `@composition/*` and from application DTOs (e.g. `@application/<name>`’s `dtos`). All other layers (domain, use-cases, flows, infrastructure) are forbidden so that composition is the single wiring layer.

Every package in `packages/*` is a pnpm workspace with its own `package.json`, `tsconfig.json`, and `src/`.

### `configs/` folder

This is where **shared configuration packages** live, used by other packages/apps but containing no domain logic.

- **`configs/config-typescript`** (`@repo/config-typescript`)
  - Contains:
    - TS presets (`base.json`, `node.json`) with common options: target, strictness, `noEmit`, etc.
  - Typical usage: extended by `tsconfig.repo.json` at the root, which is then extended by packages/apps.

- **`configs/config-eslint`** (`@repo/config-eslint`)
  - Contains:
    - ESLint flat config (v9) with:
      - `@eslint/js` + `typescript-eslint` (base + stylistic rules)
      - `eslint-plugin-boundaries` for architectural constraints
      - TypeScript resolver (`eslint-import-resolver-typescript`) configured against `tsconfig.repo.json`
    - Architectural rules enabled via `boundaries/dependencies` (e.g. domain must not import application/infrastructure; **`packages/infrastructure/driven-*` (non-repository) may import domain only under `src/errors` and `src/value-objects`**; **`driven-repository-*` may also import `src/entities`**, not domain services).
  - It is consumed by `eslint.config.js` at the root of the monorepo.

Other config packages that can live here in the future:

- `config-prettier`
- `config-jest` / `config-vitest`
- `config-stylelint`

---

## TypeScript configuration

The global TS configuration lives in `tsconfig.repo.json` and is meant to:

- avoid `.js` file extensions in imports
- allow NestJS or other Node/FE apps to compile package sources directly

Each package defines its own `tsconfig.json` extending `tsconfig.repo.json`:

---

## ESLint configuration

The main ESLint config lives in `configs/config-eslint` and is exposed from the root via `eslint.config.js`:

Key aspects of the shared config:

- uses `@eslint/js` + `typescript-eslint` (flat config)
- defines architectural layers via `eslint-plugin-boundaries`

### Lint scripts

- **Root**:
  - `pnpm lint` – ESLint on the whole monorepo (`.`)
  - `pnpm lint:fix` – ESLint with fixes
- **Packages** (e.g. `@domain/core`, `@application/core`):
  - `pnpm -C packages/domain/core lint`
  - `pnpm -C packages/domain/core lint:fix`

Thanks to the root `eslint.config.js`, you don’t need a separate ESLint config per package unless you need overrides.

---

## Code generators (Plop)

This repo uses [Plop](https://plopjs.com) to generate domain, application, infrastructure, and composition artifacts following the hexagonal conventions.

- **How to run**

  ```bash
  pnpm plop
  ```

- **Shared Plop utilities** (`plop/lib/`): `index.cjs` re-exports **casing** (`plop/lib/casing.cjs`: `toKebabCase`, `toPascalCase`, `toCamelCase`, `lowerFirst`, `toConstantCase`, `parseInterfaceMethods`) and **packages** (`plop/lib/packages.cjs`: listing workspace packages, Plop `choices`, port/entity/flow/use-case discovery, `packageJsonPath`, `readApplicationPortSource`, `ensureZodDependencyInDomainPackage`, etc.). Generators import from `../lib` (resolved via `plop/lib/package.json`).

- **Available generators** (match the names in the Plop menu):

  | Generator                             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
  | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Domain**                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | `domain-package`                      | Create a new `@domain/<name>` package with `entities`, `value-objects`, `errors`, `services` and `package.json` subpath exports (no root `src/index.ts` barrel).                                                                                                                                                                                                                                                                                                                                                                                                           |
  | `domain-entity-zod`                   | Add an Entity (Zod schema + type + class in one file) to an existing domain package; updates entities barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | `domain-value-object-zod`             | Add a Value Object (Zod schema + type + class with `equals`) to an existing domain package; updates value-objects barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
  | `domain-error`                        | Add a `DomainError` subclass to a domain package (including `core`); updates errors barrel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
  | `domain-service`                      | Add a domain service in `src/services`: pick domain package + one or more entities, name the capability (specific, not `UserService`); generates `XxxService` with `execute`, `XxxServiceInput` / `XxxServiceOutput`, imports selected entities from `../entities`, updates services barrel.                                                                                                                                                                                                                                                                               |
  | **Application**                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | `application-package`                 | Create a new `@application/<name>` package with `ports`, `use-cases`, `flows`, `dtos`, `mappers` and `package.json` subpath exports (no root `src/index.ts` barrel).                                                                                                                                                                                                                                                                                                                                                                                                       |
  | `application-use-case`                | Add a `XxxUseCase` class to an existing application package (excludes `core`), generate a `*.use-case.test.ts` file, and update the use-cases barrel.                                                                                                                                                                                                                                                                                                                                                                                                                      |
  | `application-port`                    | Add a port interface to an existing application package (excludes `core`), supporting both normal `Port` and `InteractionPort`, and update the ports barrel.                                                                                                                                                                                                                                                                                                                                                                                                               |
  | `application-flow`                    | Add a `XxxFlow` and its `XxxInteractionPort` to an application package, generate a `*.flow.test.ts` file, and update flows/ports barrels.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
  | `application-dto-mapper-for-entity`   | Given a domain entity, create DTO + mapper + `*.mapper.test.ts` in the corresponding application package (or pick another existing app package if auto-create is disabled), update dtos/mappers barrels, add `@domain/<pkg>` dependency, and ensure `vitest` + `test` script if missing.                                                                                                                                                                                                                                                                                   |
  | **Infrastructure**                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | `infrastructure-driven-adapter`       | Create a new `@infrastructure/driven-<name>` or `@infrastructure/driven-repository-<name>` package (prompt: repository adapter or not), `package.json`, `tsconfig.json`, `src/index.ts`. Do not put “repository” in the capability name; use the prompt instead.                                                                                                                                                                                                                                                                                                           |
  | `infrastructure-lib`                  | Create a new `@infrastructure/lib-<name>` package (infrastructure “library” code such as reusable utilities) under `packages/infrastructure` with `package.json`, `tsconfig.json`, and a single entry point `src/index.ts`.                                                                                                                                                                                                                                                                                                                                                |
  | `driven-port-adapter`                 | Generate or **merge** a concrete adapter for a normal application `Port` in a `driven-*` package: creates `src/adapters/*.adapter.ts` if missing; if the file exists, appends stub methods only for Port methods not yet present (does not overwrite existing methods). Updates adapters/index, package index, and `@application/<pkg>` dependency if missing.                                                                                                                                                                                                             |
  | `driven-immer-interaction-adapter`    | Generate or **merge** an Immer-based `InteractionPort` adapter under `src/interaction-adapters/`: if the file exists, **only appends** methods missing from the class (same adapter base name + port as when created). Prompt: **checkbox** of `Promise<…>` port methods to implement with the ask pattern (`currentInteraction`, `type` = method name); others get the usual `Not implemented` stub. Adds `currentInteraction` on state when any ask method exists or is merged. Re-runs do **not** rewrite existing method bodies (change ask/stub by editing the file). |
  | `infrastructure-raw-to-domain-entity` | Generate a raw-to-domain-entity mapper scaffold + `*.mapper.test.ts` in any infrastructure package: selects domain package/entity + raw type name, creates mapper under `src/mappers`, updates mappers/index and package index, and adds `@domain/<pkg>` + `vitest` (and `test` script) if missing.                                                                                                                                                                                                                                                                        |
  | **Composition**                       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | `composition-package`                 | Create a new `@composition/<name>` package with a single entry point `src/index.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | `composition-feature-dependencies`    | Add a feature (e.g. DocumentEditor) to a composition package: creates `createXxxDependencies()` in `src/<feature-kebab>/dependencies.ts` and registers it in `src/index.ts` under `dependencies.<featureCamel>` with lazy loading (getter with cache).                                                                                                                                                                                                                                                                                                                     |
  | `composition-wire-use-case`           | Wire an existing application use-case into a composition feature dependencies factory (`src/<feature>/dependencies.ts`): adds use-case import + instance in returned dependencies object, and adds `@application/<pkg>` dependency if missing.                                                                                                                                                                                                                                                                                                                             |
  | `composition-wire-flow`               | Wire an existing application flow into a composition feature dependencies factory (`src/<feature>/dependencies.ts`): adds flow import + flow factory in returned dependencies object, and adds `@application/<pkg>` dependency if missing.                                                                                                                                                                                                                                                                                                                                 |
  | `composition-wire-infrastructure`     | Wire a `driven-*` package into composition: creates/updates `src/infrastructure.ts` with lazy getters (`let _fooInstance` + `get foo()`), imports the adapter class from `@infrastructure/<driven>`, adds `workspace:*` dep, and re-exports `infrastructure` from `src/index.ts` when missing.                                                                                                                                                                                                                                                                             |
  | **UI**                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
  | `ui-package`                          | Create a new `@ui/<name>` package under `packages/ui/<name>` (e.g. `react` → `packages/ui/react`), with `package.json`, `tsconfig.json`, and `src/index.ts`.                                                                                                                                                                                                                                                                                                                                                                                                               |

Generators are intentionally minimal: they create the right folders, barrels, and base classes/interfaces, but leave TODOs where business logic or mapping must be implemented explicitly.
