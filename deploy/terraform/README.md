# Terraform reference module (AWS)

Provisions the AWS infrastructure this platform needs to run outside a
Kubernetes cluster: networking, RDS Postgres, ElastiCache Redis, ECR
repositories, an ECS Fargate cluster running the three services, an ALB, and
an S3 bucket for report artifacts.

This is a **reference module** — a correct, complete starting point, not a
turnkey production deployment. In particular:

- No backend is configured (`versions.tf`) — add an S3+DynamoDB or Terraform
  Cloud backend appropriate to your org before running this for real.
- `domain_name`/`route53_zone_id` are optional. Without them you get a plain
  HTTP ALB and **the API is not reachable through it** — see the comment in
  `alb.tf`: the web app calls the API via an absolute URL baked into its
  client bundle at image-build time, not a same-origin relative path, so
  routing the API needs a real hostname (`api.<domain_name>`) to route on.
- No ACM/HTTPS listener is wired up. Add one once `domain_name` is set (an
  `aws_acm_certificate` + validation records + an HTTPS listener on 443).

## What this does NOT do

- **Run database migrations.** Provisioning "the database exists and is
  reachable" is Terraform's job; `prisma migrate deploy` against
  `data.aws_secretsmanager_secret_version` (or the `rds_endpoint` output) is
  a deploy-pipeline step, run once after `apply` and again on every schema
  change.
- **Build or push Docker images.** `docker build --target <api|worker|web>`
  (see the root `Dockerfile`) and push to the ECR repos this module creates
  — that's CI's job, not Terraform's.
- **Choose between this and the Kubernetes/Helm path for you.** Both are
  real, working deployment targets (see `../helm/soc-platform` and
  `../../docs/deployment.md`) — this module is the ECS Fargate option. If
  you're deploying to an existing EKS cluster, use the Helm chart instead
  and only take the networking/RDS/ElastiCache/S3 pieces from here (or an
  equivalent).

## Usage

```bash
cd deploy/terraform
terraform init
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — at minimum set jwt_access_secret and cors_origin
terraform plan
terraform apply
```

After `apply`:

```bash
# 1. Push images (repeat per service)
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker build --target api -t <account>.dkr.ecr.<region>.amazonaws.com/soc-platform-<env>-api:latest ../..
docker push <account>.dkr.ecr.<region>.amazonaws.com/soc-platform-<env>-api:latest
# ...repeat for worker, web

# 2. Apply database migrations (one-time, and again on every schema change)
DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id soc-platform-<env>/database-url --query SecretString --output text) \
  pnpm --filter @soc/database exec prisma migrate deploy

# 3. Force a new deployment once images are pushed
aws ecs update-service --cluster soc-platform-<env> --service soc-platform-<env>-api --force-new-deployment
aws ecs update-service --cluster soc-platform-<env> --service soc-platform-<env>-worker --force-new-deployment
aws ecs update-service --cluster soc-platform-<env> --service soc-platform-<env>-web --force-new-deployment
```

## Rollback

ECS keeps the previous task definition revision around — rolling back a bad
deploy is pointing the service back at it, not a Terraform operation:

```bash
aws ecs update-service --cluster soc-platform-<env> --service soc-platform-<env>-api \
  --task-definition soc-platform-<env>-api:<previous-revision-number>
```

See `../../docs/deployment.md` for the fuller rollback discussion, including
the database-migration side of a rollback (which this alone doesn't cover —
Prisma migrations are forward-only by convention).
