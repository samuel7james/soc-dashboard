# syntax=docker/dockerfile:1.7
#
# One Dockerfile, three runtime targets (api / worker / web) — the pnpm
# install and workspace build machinery is identical for all three, so this
# avoids maintaining the same "deps" stage three times. Build a specific
# service with:
#   docker build --target api    -t soc-platform/api    .
#   docker build --target worker -t soc-platform/worker .
#   docker build --target web    -t soc-platform/web    .
#
# apps/api and apps/worker are bundled with esbuild (see
# packages/config/build-node-app.mjs) rather than tsc: the shared @soc/*
# packages ship as raw TypeScript with no build step of their own, so a
# plain `node dist/index.js` can't resolve them at runtime without either
# bundling or a TS loader. Bundling inlines first-party source and leaves
# real npm dependencies external, resolved normally from node_modules.

FROM node:20-bookworm-slim AS base
# Prisma's query engine needs OpenSSL to be present to detect the correct
# engine binary — without it, `prisma generate`/postinstall falls back to a
# guessed version that may not match what's actually on the system.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
ENV CI=true
WORKDIR /repo

# ---- manifests only, for layer caching: reinstall only when deps change ----
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/connectors/package.json packages/connectors/package.json
COPY packages/config/package.json packages/config/package.json
# @prisma/client's postinstall generates the client during `pnpm install`
# below — it needs the real schema present at that point, or it silently
# generates a non-functional stub (throws "did not initialize" at runtime).
COPY packages/database/prisma packages/database/prisma

# ---- full install (build tooling included), used to compile everything ----
# The root package.json's own "postinstall" script explicitly runs `prisma
# generate` here — @prisma/client's own postinstall auto-detects the schema
# relative to wherever `pnpm install` was invoked from (repo root) rather
# than searching per-workspace-package, so in a monorepo it silently
# generates a non-functional stub client instead of erroring.
FROM manifests AS deps
RUN pnpm install --frozen-lockfile

# ---- compile all three apps ----
FROM deps AS build
COPY . .
RUN pnpm --filter @soc/api build
RUN pnpm --filter @soc/worker build
# NEXT_PUBLIC_* variables are inlined into the client JS bundle at build
# time by Next's compiler — setting NEXT_PUBLIC_API_URL as a *runtime*
# container env var on the `web` image would silently have no effect on
# already-built pages, so it has to come in as a build arg instead.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @soc/web build

# api/worker runtime images copy node_modules from `build` (full install,
# including devDependencies) rather than a separate --prod-only install.
# `pnpm prune --prod` was tried here and unexpectedly wiped every symlink
# out of the nested apps/*/node_modules (a workspace-specific pnpm quirk,
# not a config mistake) — copying the already-known-good `build` tree is
# simpler and guaranteed correct, at the cost of shipping devDependencies
# (typescript, eslint, vitest, ...) that the running app never imports.
# Slimming this further (e.g. via `pnpm deploy` once verified, or Prisma's
# custom generator `output` to sidestep node_modules hashing entirely) is
# a worthwhile follow-up, not a blocker for a working image.

# ================= api =================
FROM node:20-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=build /repo/apps/api/package.json /repo/apps/api/package.json
COPY --from=build /repo/apps/api/dist /repo/apps/api/dist
WORKDIR /repo/apps/api
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]

# ================= worker =================
FROM node:20-bookworm-slim AS worker
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules /repo/node_modules
COPY --from=build /repo/apps/worker/node_modules /repo/apps/worker/node_modules
COPY --from=build /repo/apps/worker/package.json /repo/apps/worker/package.json
COPY --from=build /repo/apps/worker/dist /repo/apps/worker/dist
WORKDIR /repo/apps/worker
EXPOSE 5514/udp
USER node
CMD ["node", "dist/index.js"]

# ================= web =================
FROM node:20-bookworm-slim AS web
ENV NODE_ENV=production
WORKDIR /repo
# Next's standalone output already traces and includes only the node_modules
# the built app actually needs — no prod-deps install required for this one.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
WORKDIR /repo/apps/web
EXPOSE 3000
USER node
CMD ["node", "server.js"]
