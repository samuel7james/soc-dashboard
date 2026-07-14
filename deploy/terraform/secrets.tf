resource "aws_secretsmanager_secret" "jwt_access_secret" {
  name = "${local.name}/jwt-access-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_access_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_access_secret.id
  secret_string = var.jwt_access_secret
}
