## hexagonal-monorepo-template

pnpm-based monorepo designed for a hexagonal architecture (Domain / Application / Infrastructure / Presentation) with shared configuration for TypeScript, ESLint, and Prettier.

### Requirements

- Node.js >= 20
- pnpm 9.x

### Setup

```bash
pnpm install --no-frozen-lockfile
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
    - DB/API access, orchestration of use cases, Presentation code (React, Nest controllers, etc.).

- **`packages/application/*`**
  - Example: `packages/application/core` (`@application/core`)
  - Should contain:
    - Use cases, Ports, DTOs, mappers (Domain ↔ DTO), application-level error handling.
  - Should _not_ contain:
    - Infrastructure details (HTTP clients, CMS/DB SDKs, UI state stores), View code.

- **`packages/infrastructure/*`**
  - Reusable driving adapters (e.g. HTTP controllers, CLI entrypoints, Presentation components that call use cases).
  - Driven adapters (e.g. repositories to DB/CMS, InteractionPort adapters, external clients).

- **`packages/composition/*`**
  - Example: `packages/composition/web` (`@composition/web`)
  - Composition packages wire together domain, application, and infrastructure for a given app or surface.
  - They have a single entry point (`src/index.ts`) and may import from domain, application, and infrastructure.
  - They must _not_ import from `apps/*`.

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
    - Architectural rules enabled via `boundaries/dependencies`, (i.e. Domain must not import from Application)
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

This repo uses [Plop](https://plopjs.com) to generate domain, application, and infrastructure artifacts following the hexagonal conventions.

- **How to run**

  ```bash
  pnpm plop --plopfile plop/plopfile.cjs
  ```

- **Available generators (high level)**:
  - **Domain packages / building blocks**
    - `domain-package`: create a new `@domain/<name>` package with `entities`, `value-objects`, `errors`, `services` structure.
    - `domain-entity-zod`: add an Entity (Zod schema + type + class in a single file) to an existing domain package and export it from the barrel.
    - `domain-value-object-zod`: add a Value Object (Zod schema + type + class with `equals` method) to an existing domain package.
    - `domain-error`: add a `DomainError` subclass (extending `@domain/core`) to a domain package (including `core`) and export it.
  - **Application layer**
    - `application-package`: create a new `@application/<name>` package with `ports`, `use-cases`, `flows`, `dtos`, `mappers` and proper `exports`.
    - `application-use-case`: add a new `XxxUseCase` class to an existing application package and export it from `use-cases/index.ts`.
    - `application-port`: add a new port interface (empty contract) under `src/ports` and export it from `ports/index.ts`.
    - `application-flow`: add a new `XxxFlow` plus its `XxxInteractionPort` in the same application package and export both from their barrels.
    - `domain-entity-dto-mapper`: given a domain Entity, create the corresponding application package (if missing), DTO and mapper + barrel exports.
  - **Infrastructure**
    - `infrastructure-driven-adapter`: create a new `@infrastructure/driven-<name>` package under `packages/infrastructure` with `package.json`, `tsconfig.json` and `src/index.ts`.
  - **Composition**
    - `composition-package`: create a new `@composition/<name>` package under `packages/composition` with a single entry point `src/index.ts` (can import from domain, application, infrastructure; cannot import from apps).
    - `composition-feature-dependencies`: add a feature (e.g. DocumentEditor) to a composition package: creates a factory `createXxxDependencies()` in `src/<feature-kebab>/dependencies.ts` and registers it in `src/index.ts` under `dependencies.<featureCamel>` with lazy loading (getter with cache).

Generators are intentionally minimal: they create the right folders, barrels, and base classes/interfaces, but leave TODOs where business logic or mapping must be implemented explicitly.
