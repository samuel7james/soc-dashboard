#!/usr/bin/env node
// Bundles a Node app (apps/api, apps/worker) with esbuild for production.
//
// Why this exists: the shared @soc/* packages (types, ui, auth, database,
// connectors) ship as raw TypeScript with no build step of their own — they
// work at dev time via tsx (which understands .ts natively) and in apps/web
// via Next's transpilePackages, but plain `node dist/index.js` cannot resolve
// a bare "@soc/database" import to a package.json "main" that points at a
// .ts file. `tsc`'s per-file emit doesn't fix this either: it only compiles
// the app's own src/, leaving the cross-workspace imports unresolved at
// runtime. Bundling the app's first-party source (its own src/ plus every
// @soc/* package it imports) into one file sidesteps the problem entirely.
//
// Every *real* npm dependency stays external and is resolved normally from
// node_modules at runtime — so native bindings (@prisma/client's query
// engine, @node-rs/argon2) and dynamic-require mechanisms (pino transports,
// fastify plugin loading) are never touched by the bundler. Those real deps
// are declared not just on the app itself but potentially several @soc/*
// packages deep (e.g. @soc/auth depends on @node-rs/argon2), so the
// external list is built by walking the workspace dependency graph rather
// than reading just the app's own package.json.
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const WORKSPACE_PREFIX = "@soc/";

function readPackageJson(dir) {
  return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
}

function resolveWorkspacePackageDir(name, fromDir) {
  // pnpm symlinks a package's direct workspace dependencies into its own
  // node_modules — resolve relative to whichever package declared `name`.
  return path.join(fromDir, "node_modules", ...name.split("/"));
}

function collectExternalDeps(rootDir) {
  const external = new Set();
  const queue = [rootDir];
  const visited = new Set();

  while (queue.length > 0) {
    const dir = queue.shift();
    if (visited.has(dir)) continue;
    visited.add(dir);

    const pkg = readPackageJson(dir);
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      if (name.startsWith(WORKSPACE_PREFIX)) {
        // Resolve relative to *this* package's own node_modules, not the
        // root app's — pnpm only guarantees a package's direct dependencies
        // are symlinked into its own node_modules (strict, non-hoisted), and
        // a nested @soc/* dep (e.g. @soc/database -> @soc/auth) may not be a
        // direct dependency of the app being built at all.
        queue.push(resolveWorkspacePackageDir(name, dir));
      } else {
        external.add(name);
      }
    }
  }

  return [...external];
}

const cwd = process.cwd();
const external = collectExternalDeps(cwd);

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  external,
});
