# SOC Platform

An enterprise-grade Security Operations Center platform, in active rebuild. See [`PROJECT_PLAN.md`](PROJECT_PLAN.md) for the full architecture/audit and [`TASKS.md`](TASKS.md) for phase-by-phase progress.

The original bash-script-driven demo (Express + vanilla JS, `Math.random()`-backed "live" data) has been moved to [`legacy/`](legacy/) and is being replaced incrementally by the monorepo below. It still runs standalone via `node legacy/api/api_server.js` if needed for reference.

## Monorepo layout

```text
apps/
  web/          Next.js 15 (App Router, TypeScript strict, Tailwind, shadcn-style UI)
  api/          Fastify API (TypeScript strict, Zod validation, Pino logging)
packages/
  types/        Shared Zod schemas + inferred types, consumed by both apps
  ui/           Shared design tokens, theme provider, and cross-cutting components
  config/       Shared base tsconfig
legacy/         Pre-rebuild application (Express + bash scripts), kept for reference
```

## Requirements

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable` or `npm i -g pnpm`)

## Getting started

```bash
pnpm install

# copy env templates
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

pnpm dev          # runs all apps in parallel via Turborepo
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000> (`/health`, `/ready`, `/api/v1`)

## Scripts

Run from the repo root (fanned out to every workspace package via Turborepo):

```bash
pnpm build       # production build
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest
```

## Status

Phase 2 (Architecture & Foundation) is complete: monorepo scaffolding, design system/theme, routing skeleton for all core sections, and shared state (TanStack Query + Zustand) are in place. No persistence, auth, or real domain data yet — that lands in Phases 3–5. See `TASKS.md` for the live checklist.

## License

MIT — see [LICENSE](LICENSE).
