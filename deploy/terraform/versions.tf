terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # No backend configured here on purpose — this is a reference module, not
  # a ready-to-apply environment. Add a backend block (S3 + DynamoDB lock
  # table, or Terraform Cloud) appropriate to your org before running this
  # for real; a hardcoded backend here would silently point every consumer
  # of this module at the same state file.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "soc-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
