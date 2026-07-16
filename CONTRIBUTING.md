# Contributing

## Getting set up

See the [README's Getting started section](README.md#getting-started) —
`pnpm install`, `docker compose up -d` for Postgres/Redis, migrate + seed,
`pnpm dev`.

## Before you open a PR

```bash
pnpm format:check   # Prettier
pnpm lint           # ESLint, every workspace package
pnpm typecheck      # tsc --noEmit, every workspace package
pnpm test:coverage  # Vitest, every workspace package with tests
pnpm build          # production build, every app
```

All five run in CI (`ci.yml`) on every push and PR — `pnpm test:coverage`
also enforces per-package coverage thresholds (see each package's
`vitest.config.ts`); a PR that drops coverage below the threshold fails the
build, not just a warning.

If you touched `apps/web`, also run the E2E + accessibility suite locally
(it needs Postgres/Redis up and the DB migrated/seeded — see the README):

```bash
pnpm --filter @soc/web exec playwright install --with-deps chromium  # once
pnpm --filter @soc/web test:e2e
```

## Code conventions

- **TypeScript strict everywhere**, including `noUncheckedIndexedAccess`
  and `exactOptionalPropertyTypes` — see `packages/config/tsconfig.base.json`.
- **Zod is the single source of truth for a shape.** If a value crosses an
  API boundary, its schema lives in `packages/types` and both `apps/web`
  and `apps/api` import it — don't redefine a shape independently in a
  second place.
- **No mocked data presented as real.** If a feature has no real backing
  data source yet, its empty/unavailable state says so honestly rather than
  filling the gap with `Math.random()` or a hardcoded placeholder. Demo Mode
  (`apps/worker/src/demo/demo-generator.ts`) is the one deliberate exception,
  and it's always visibly labeled as synthetic in the UI.
- **No comments explaining _what_ code does** — well-named identifiers
  already do that. A comment earns its place by explaining a _non-obvious
  why_: a hidden constraint, a workaround for a specific bug, a decision
  that would otherwise look arbitrary. Several files in this repo lean on
  this heavily (e.g. `apps/api/otel/instrumentation.mjs`,
  `packages/config/build-node-app.mjs`) — that's the bar.
- **Don't build ahead of need.** This codebase has explicit, documented
  scope boundaries (on-demand report export instead of a persisted `Report`
  entity with scheduling; detection rules as code, not a database table) —
  match that discipline rather than speculatively generalizing.

## Testing conventions

- **Integration tests hit a real local Postgres/Redis**, not mocks — see
  any `apps/api/src/routes/v1/*.test.ts` for the pattern (`buildApp()` +
  `TestClient`, real `prisma.*.create()` fixtures, `afterAll` cleanup by
  the exact IDs created). This project got burned once already by a class
  of bug (Prisma FK constraints, Turborepo env-var stripping) that only a
  real database and a real CI environment surfaced — mocks would have
  hidden both.
- **A bug found by a test gets fixed, not worked around.** Several real
  bugs in this codebase's history were caught by adding test coverage a
  route didn't have yet (a CSRF race condition, an accessibility violation
  affecting every dropdown in the app, an N+1 query). If your test finds
  something, the fix belongs in the same PR.

## Commit messages

Explain the _why_, not the _what_ — the diff already shows what changed.
Reference the specific bug/decision if there is one. Look at recent commit
history for the tone this repo uses.

## Reporting a security issue

See [`docs/security.md`](docs/security.md) for the platform's security
posture. If you find a genuine vulnerability, open an issue describing it —
there's no separate private disclosure address for this project.
