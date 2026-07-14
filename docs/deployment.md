# Deployment

Two supported deployment paths, both consuming the same three Docker images
built from the root `Dockerfile` (`docker build --target api|worker|web` —
see Phase 7 / `docs/ci-cd.md`):

| Path                        | Where                      | Compute                                  | Use when                                                       |
| --------------------------- | -------------------------- | ---------------------------------------- | -------------------------------------------------------------- |
| **Kubernetes / Helm**       | `deploy/helm/soc-platform` | Any K8s cluster (EKS, GKE, self-managed) | You already run Kubernetes                                     |
| **Terraform / ECS Fargate** | `deploy/terraform`         | AWS ECS Fargate                          | You want AWS-native compute without running a cluster yourself |

Terraform provisions the same underlying dependencies either way (RDS
Postgres, ElastiCache Redis, S3, networking) — if you're on EKS, take the
networking/RDS/ElastiCache/S3 resources from the Terraform module and point
the Helm chart's `secret.values` at their outputs instead of standing up the
ECS half.

Both paths were validated for real during Phase 8, not just written and
assumed correct:

- The Helm chart was installed onto a real local Kubernetes cluster (`kind`),
  including a genuine login round-trip (argon2 password check + JWT issuance
  - cookies) through a `kubectl port-forward` to the cluster-deployed API,
    a live Postgres-outage/recovery test against the readiness probes (see
    below), and a real `helm upgrade` → broken rollout → `helm rollback` cycle.
- The Terraform module was `init`/`validate`/`plan`'d successfully — `plan`
  got as far as building the full resource graph and only stopped at "no AWS
  credentials in this environment," not a configuration error.

## Readiness probes are real, not decorative

`GET /ready` on the API and worker both execute a real query against
Postgres (`SELECT 1`) and ping Redis — they don't just return `200` because
the process is alive (that's what `/health` is for). This was deliberately
verified live during Phase 8: stopping the local Postgres container while
the API/worker were running flipped `/ready` to `503` within one failed
probe, and — more importantly — **did not crash either process**. A worker
bug found in the course of this (the Demo Mode supervisor's polling loop had
no error handling around its Prisma calls) meant a transient database blip
used to crash the _entire_ worker process, taking every queue processor and
the syslog listener down with it; that's fixed (`apps/worker/src/demo/demo-generator.ts`,
`apps/worker/src/listeners/syslog-listener.ts`). In Kubernetes/ECS terms:
before the fix, a momentary RDS blip would crash-loop the worker task
indefinitely; after, it correctly reports not-ready and recovers on its own
once the database comes back — no restart needed.

## Kubernetes / Helm

```bash
cd deploy/helm/soc-platform
helm install soc-platform . \
  -f values.yaml -f values-<dev|staging|prod>.yaml \
  --set secret.values.databaseUrl="postgresql://..." \
  --set secret.values.redisUrl="redis://..." \
  --set secret.values.jwtAccessSecret="$(openssl rand -base64 48)"
```

Prefer `secret.existingSecret: <name>` over `secret.values.*` for anything
beyond local testing — see the comments in `values.yaml`. Migrations are not
run by the chart; apply them once per install/schema-change:

```bash
DATABASE_URL=<from-your-secret> pnpm --filter @soc/database exec prisma migrate deploy
```

**Rollback:**

```bash
helm rollback soc-platform [revision] -n <namespace>
```

Helm keeps prior revisions (`helm history soc-platform -n <namespace>`) and
rolling back just re-applies the previous manifest set — Kubernetes' own
rolling-update mechanics mean a bad rollout doesn't cause downtime in the
first place (old pods keep serving until new ones pass their readiness
probe; a permanently-broken new image just never gets traffic, and the old
ReplicaSet's pods stay up). This was directly observed during validation: a
deliberately broken image tag left the previous revision's pods at `1/1
Running` throughout.

## Terraform / ECS Fargate

```bash
cd deploy/terraform
terraform init
cp terraform.tfvars.example terraform.tfvars   # fill in jwt_access_secret, cors_origin
terraform apply
```

See `deploy/terraform/README.md` for the full push-images / migrate /
force-new-deployment sequence after `apply`.

**Rollback:**

```bash
aws ecs update-service --cluster soc-platform-<env> --service soc-platform-<env>-api \
  --task-definition soc-platform-<env>-api:<previous-revision>
```

ECS retains task definition revisions the same way Helm retains chart
revisions — rolling back is pointing the service at the old one, not a
Terraform operation (Terraform owns infrastructure, not which image tag is
currently running).

## Database migration rollback — the honest version

Neither path above "rolls back a migration" as part of an app rollback, and
that's deliberate, not an omission: **Prisma migrations are forward-only by
convention** (see `packages/database/prisma/migrations/`) — there's no
generated down-script to run. Rolling back the _application_ to a previous
image while the database schema has already moved forward only works
safely if the migration was additive (new nullable column, new table, new
index) and the old code simply ignores the new column/table it doesn't know
about — the **expand/contract pattern**:

1. **Expand**: ship a migration that only adds (nullable column, new table).
   Deploy it. Old and new application code both still work against it.
2. **Migrate**: deploy the application code that uses the new shape.
3. **Contract**: once you're confident you won't roll back, ship a second
   migration that removes anything the old shape needed (e.g. drop an old
   column, add a `NOT NULL` constraint).

If you need to undo a migration that already contracted the schema (dropped
a column an old app version needs), rolling back the app isn't enough — you
need a new _forward_ migration that reintroduces what was removed, then roll
the app back once that's applied. There is no shortcut around this; treat
"can I roll back the app independently of the database" as a question to
ask _before_ writing a migration, not after a bad deploy.
