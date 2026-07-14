resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name}-redis"
  subnet_ids = module.vpc.database_subnets
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id      = "${local.name}-redis"
  engine          = "redis"
  engine_version  = "7.1"
  node_type       = var.redis_node_type
  num_cache_nodes = 1
  port            = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # A single node is a reference-module simplification, matching this app's
  # own fail-open caching design (apps/api/src/lib/redis.ts: a Redis outage
  # degrades to slower responses, not an incident) — Redis holds no data
  # that can't be regenerated from Postgres. For prod HA, switch this to
  # aws_elasticache_replication_group with automatic failover instead.
}

resource "aws_secretsmanager_secret" "redis_url" {
  name = "${local.name}/redis-url"
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id     = aws_secretsmanager_secret.redis_url.id
  secret_string = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
}
