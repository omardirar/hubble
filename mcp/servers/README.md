# MCP Servers — AWS App Runner Deployment

## Overview

This repository packages one or more Model Context Protocol (MCP) servers into a single container image that can be deployed to AWS App Runner. The image currently ships with the open-source MotherDuck MCP server running over the streamable HTTP transport behind a lightweight Caddy reverse proxy.

- Upstream MotherDuck MCP server: `mcp-server-motherduck` (MIT). The vendored source lives under `motherduck/`.
- Caddy terminates HTTPS on App Runner, exposes a `/health` endpoint, and proxies `/motherduck` requests to the MCP server listening on port `9001` inside the container.
- Additional MCP servers can be added on other internal ports and mapped to new HTTP paths.

## Architecture

- Client (Anthropic `mcp_servers`) → HTTPS (App Runner) → Caddy `:${PORT}` → MotherDuck MCP `:9001` (HTTP streamable)
- Default `PORT` is `8080`. App Runner injects this environment variable automatically; when running locally you can override it.

## Prerequisites

- Docker (or another OCI-compatible builder)
- AWS CLI v2 configured with permissions for Amazon ECR and AWS App Runner (`aws configure`)
- MotherDuck read-scaling token (recommended)
- uv CLI (`curl -LsSf https://astral.sh/uv/install.sh | sh`) with `~/.local/bin` on your `PATH`
- Optional: AWS CDK/Terraform if you prefer infrastructure-as-code

## Monorepo Integration

- Package name: `@hubble/mcp-servers` (pnpm workspace member)
- Formatting: `pnpm --filter @hubble/mcp-servers lint` or `format`
- Build: `pnpm --filter @hubble/mcp-servers docker:build` (targets Linux AMD64 for App Runner)
- Python lint: `uvx ruff check mcp/servers/motherduck`
- Python format: `uvx ruff format mcp/servers/motherduck`
- CI: `.github/workflows/ci.yml` runs `pnpm docker:build` after the standard web/API builds

## Quick Start (Local Sanity Check)

```bash
# Build the container image
docker build -t mcp-servers:dev .

# Run locally (maps host 8080 → container `PORT`)
PORT=8080 docker run \
  -p 8080:8080 \
  -e PORT=8080 \
  -e MOTHERDUCK_TOKEN=REDACTED \
  mcp-servers:dev

# Health check
curl -i http://localhost:8080/health
```

## Deploy to AWS App Runner (GitHub Connection)

1. **Push this repository to GitHub** and choose the branch you want App Runner to watch (e.g., `main`).

2. **Authorize App Runner to read the repository:**

```bash
aws apprunner create-connection \
  --connection-name mcp-servers-github \
  --provider-type GITHUB
```

Complete the OAuth handshake in the AWS console so App Runner can access the repo.

3. **Create an Amazon ECR repository (one time):**

```bash
aws ecr create-repository --repository-name mcp-servers
```

4. **Provision the App Runner service pointing at the ECR image:**

```bash
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/mcp-servers:latest"

aws apprunner create-service \
  --service-name mcp-motherduck \
  --source-configuration "ImageRepository={ImageIdentifier=$IMAGE_URI,ImageRepositoryType=ECR,ImageConfiguration={Port=8080}},AuthenticationConfiguration={AccessRoleArn=<app-runner-ecr-access-role>}" \
  --instance-configuration Cpu=1vCPU,Memory=2GB \
  --health-check-configuration Path="/health",Protocol="HTTP",Interval=10,Timeout=5,HealthyThreshold=1,UnhealthyThreshold=5
```

Supply the App Runner IAM access role that grants `ecr:GetDownloadUrlForLayer` and `ecr:BatchGetImage`. After the service is created, enable _Auto deploy_ from ECR so every new image revision triggers a deployment.

5. **Configure secrets and environment variables** (via the console or CLI) for `MOTHERDUCK_TOKEN`, `DEFAULT_LIMIT`, and any other runtime settings.

6. **Wire GitHub → ECR image builds** using the provided GitHub Actions workflow (see below) so commits automatically produce a new container image for App Runner.

When the service is live, requests to `https://<service-default-domain>/motherduck` reach the MCP server, and `/health` serves the container health check.

### Continuous Deployment from GitHub

`/.github/workflows/app-runner-deploy.yml` builds the Docker image on every push to `main`, pushes it to the ECR repository, and calls `aws apprunner update-service` to deploy the new revision. Provide the following repository secrets:

- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME` (IAM role with ECR:Push, AppRunner:UpdateService)
- `ECR_REPOSITORY`
- `APP_RUNNER_SERVICE_ARN`

App Runner’s GitHub connection keeps credentials in sync and lets you enable automatic deployments per branch without manual pushes.

## Using with Anthropic MCP

Update your `mcp_servers` client configuration:

```json
{
  "mcp_servers": {
    "motherduck": {
      "url": "https://<service-default-domain>/motherduck",
      "transport": "stream"
    }
  }
}
```

Each request must include:

```http
Authorization: Bearer <motherduck_token>
X-Db-Name: <database_name>
anthropic-beta: mcp-client-2025-04-04
```

`MOTHERDUCK_TOKEN` on the container acts as a fallback for stdio clients; HTTP transports expect request-scoped Bearer tokens.

## Security & Best Practices

- Run with `--saas-mode` (enabled by default in `start.sh`) and scoped MotherDuck tokens.
- Rotate credentials using AWS Secrets Manager, and map them into App Runner via service secrets.
- Use AWS WAF or IAM access-controlled URLs if you need to restrict traffic further.
- Monitor CloudWatch logs generated by App Runner for request patterns and errors.

## Scaling & Multi-Server Expansion

- Additional MCP servers can be launched from `start.sh` on new internal ports (e.g., `9002`), then proxied by adding `handle_path` blocks in `Caddyfile`.
- Scale out by increasing App Runner concurrency, or deploy separate services per MCP server if isolation is required.

## Local Testing

```bash
uvx pytest -q
```

Unit tests cover HTTP header extraction and rely on monkeypatched DuckDB connections to avoid touching live MotherDuck resources.

## License & Credits

- MotherDuck MCP server is MIT-licensed. See `motherduck/README.md` and the upstream project for details.
- Credits to MotherDuck and the MCP community.
