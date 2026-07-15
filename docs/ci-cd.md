# CI/CD

Two workflows live under `.github/workflows/`.

## `ci.yml`

Triggers on every push to `main` and every pull request.

| Job              | What it does                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint-typecheck` | `pnpm format:check`, `pnpm lint`, `pnpm typecheck` across the whole workspace                                                                                              |
| `test`           | Boots real Postgres + Redis service containers, runs `prisma migrate deploy`, then `pnpm test:coverage` (all 39+ API integration tests, worker/auth/connectors unit tests) |
| `build`          | `pnpm build` — compiles all 3 apps + packages                                                                                                                              |
| `docker-build`   | Builds the `api`, `worker`, and `web` Docker targets (matrix job) to catch Dockerfile breakage, without pushing anywhere                                                   |

Coverage reports (lcov + json-summary, one per tested package) are uploaded as
a workflow artifact on every run (`coverage-reports`, 14-day retention). No
external coverage service (Codecov, Coveralls) is wired up — there's no
account for one yet. Adding one later is just: add its action + a repo secret
to the `test` job; the lcov output it needs is already produced.

## `security.yml`

Triggers on push to `main`, pull requests, and a weekly Monday-morning cron
(so newly-disclosed CVEs in existing dependencies get caught even in weeks
with no code changes).

| Job           | What it does                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `codeql`      | GitHub's native SAST for the JS/TS codebase                                                                        |
| `semgrep`     | `semgrep scan --config auto` (community ruleset — no Semgrep account needed)                                       |
| `gitleaks`    | Full-history secret scan                                                                                           |
| `osv-scanner` | Scans `pnpm-lock.yaml` against the OSV.dev database (reusable workflow) — fails the job on any known vulnerability |
| `sbom`        | Generates a CycloneDX SBOM via Syft, uploaded as an artifact                                                       |
| `trivy`       | Builds each of the 3 Docker images locally and scans for CRITICAL/HIGH CVEs (matrix job)                           |

CodeQL, Semgrep, and Trivy findings all upload as SARIF to GitHub's Security
tab via `github/codeql-action/upload-sarif` — they show up in one place
regardless of which tool found them.

### Dependency audit baseline

Phase 1's initial audit found 11 vulnerabilities (6 high, 5 moderate). As of
Phase 7, `pnpm audit` reported **zero** known vulnerabilities — the two real
fixable issues found while wiring up this phase (a critical arbitrary-file-read
in `vitest` <3.2.6, and a high-severity `vite` `server.fs.deny` bypass) were
fixed directly: `vitest`/`@vitest/coverage-v8` bumped to `^3.2.6` across every
package that runs tests, plus root-level `pnpm.overrides` forcing
`vite >= 6.4.3` and `postcss >= 8.5.10` (the latter a transitive Next.js
dependency).

`pnpm audit` itself was later dropped from CI (see `osv-scanner` above): it
called npm's legacy quick-audit endpoint, which the npm registry retired in
favor of a bulk advisory endpoint, and that fix only landed in pnpm v11
(which requires Node 22). OSV-Scanner replaced it without needing a runtime
bump — re-verified locally against the current `pnpm-lock.yaml` (972
packages) with zero issues found before switching.

## Dependabot

`.github/dependabot.yml` covers three ecosystems, all weekly:

- **npm** (directory `/`) — one entry for the whole pnpm workspace; minor/patch
  bumps are grouped into a single PR to cut noise, majors stay individual so a
  breaking change is never silently bundled in.
- **docker** — the base images in the root `Dockerfile`.
- **github-actions** — action versions used in the two workflows above.

## Branch protection (manual — requires GitHub repo admin access)

This is a repository _setting_, not a file in the repo, so it can't be
committed or configured from this environment. A repo admin should configure,
under **Settings → Branches → Branch protection rules** (or the newer
Rulesets UI) for `main`:

- **Require a pull request before merging** (no direct pushes to `main`).
- **Require status checks to pass before merging**, with these required checks
  (exact names as they appear in the Actions tab/PR checks list once a run
  has completed — the `osv-scanner` job in particular reports under a name
  derived from the reusable workflow, so confirm it there rather than
  assuming the string below):
  - `Lint & Typecheck`
  - `Unit & Integration Tests`
  - `Build`
  - `Docker Build (api / worker / web)` (all 3 matrix legs)
  - `CodeQL`
  - `OSV-Scanner (dependency vulnerabilities)`
  - `Trivy image scan` (all 3 matrix legs)
- **Require branches to be up to date before merging.**
- Optionally: require `gitleaks` and `Semgrep` too once their signal-to-noise
  ratio has been tuned for this codebase (SAST tools are prone to false
  positives on day one; starting them as non-blocking and promoting them to
  required once the baseline is clean avoids blocking merges on noise).
