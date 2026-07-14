output "alb_dns_name" {
  description = "Public ALB DNS name — the web app is reachable here directly if domain_name isn't set."
  value       = aws_lb.main.dns_name
}

output "ecr_repository_urls" {
  description = "Push images here from CI (docker build --target <api|worker|web> per the root Dockerfile, then docker push)."
  value       = { for k, repo in aws_ecr_repository.app : k => repo.repository_url }
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "rds_endpoint" {
  description = "Postgres endpoint (host:port) — the full connection string lives in Secrets Manager, not in state/outputs."
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "secrets_manager_arns" {
  description = "ARNs of the three secrets ECS task definitions read at container start."
  value = {
    database_url      = aws_secretsmanager_secret.database_url.arn
    redis_url         = aws_secretsmanager_secret.redis_url.arn
    jwt_access_secret = aws_secretsmanager_secret.jwt_access_secret.arn
  }
}

output "s3_artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
