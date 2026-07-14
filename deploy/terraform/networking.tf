data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs             = slice(data.aws_availability_zones.available.names, 0, var.availability_zone_count)
  name            = "${var.project_name}-${var.environment}"
  private_subnets = [for i in range(var.availability_zone_count) : cidrsubnet(var.vpc_cidr, 8, i)]
  public_subnets  = [for i in range(var.availability_zone_count) : cidrsubnet(var.vpc_cidr, 8, i + 100)]
  db_subnets      = [for i in range(var.availability_zone_count) : cidrsubnet(var.vpc_cidr, 8, i + 200)]
}

# The well-known, widely-audited community VPC module rather than hand-rolled
# subnet/route-table resources — fewer places for a reference module to get
# AWS networking subtly wrong.
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"

  name = local.name
  cidr = var.vpc_cidr
  azs  = local.azs

  private_subnets  = local.private_subnets # ECS Fargate tasks
  public_subnets   = local.public_subnets  # ALB
  database_subnets = local.db_subnets      # RDS + ElastiCache — isolated from the app subnets too

  enable_nat_gateway     = true
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = !var.single_nat_gateway

  enable_dns_hostnames = true
  enable_dns_support   = true

  create_database_subnet_group = true
}
