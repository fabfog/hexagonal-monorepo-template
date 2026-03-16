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

This is where packages with **domain / application code** live, not tooling-only packages.

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

- **(Future) `packages/infrastructure/*`**
  - Driving adapters (e.g. HTTP controllers, CLI entrypoints, Presentation components that call use cases).
  - Driven adapters (e.g. repositories to DB/CMS, InteractionPort adapters, external clients).

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

- centralise workspace aliases (e.g. `@domain/core`, `@application/core`)
- avoid `.js` file extensions in imports
- allow NestJS or other Node/FE apps to compile package sources directly

Excerpt from `tsconfig.repo.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./configs/config-typescript/base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // will be populated with paths for different packages, i.e.
      "@domain/core": ["packages/domain/core/src"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

Each package (`@domain/core`, `@application/core`, future apps) defines its own `tsconfig.json` extending `tsconfig.repo.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../../tsconfig.repo.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Thanks to `paths`:

- imports like `import { X } from '@domain/core';` work without `.js`
- a Nest/FE app extending `tsconfig.repo.json` will also compile domain/application sources.

---

## ESLint configuration

The main ESLint config lives in `configs/config-eslint` and is exposed from the root via `eslint.config.js`:

```js
// eslint.config.js (root)
import baseConfig from '@repo/config-eslint';

export default [...baseConfig];
```

Key aspects of the shared config:

- uses `@eslint/js` + `typescript-eslint` (flat config)
- defines architectural layers
- uses the TS resolver pointing to the root `tsconfig.repo.json`, so aliases like `@domain/core` / `@application/core` are understood by the boundaries plugin.

### Lint scripts

- **Root**:
  - `pnpm lint` – ESLint on the whole monorepo (`.`)
  - `pnpm lint:fix` – ESLint with fixes
- **Packages** (e.g. `@domain/core`, `@application/core`):
  - `pnpm -C packages/domain/core lint`
  - `pnpm -C packages/domain/core lint:fix`

Thanks to the root `eslint.config.js`, you don’t need a separate ESLint config per package unless you need overrides.
