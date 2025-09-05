## 0.1.a1 - 2025-09-03

### Added

- CHANGELOG introduced.

### Changed

- Fixed `:root` selector in `src/app/globals.css` to restore theming.
- Hardened `/api/chat`:
  - Unified Anthropic model selection via `ANTHROPIC_MODEL` with fallback.
  - Gated telemetry by `LOG_LEVEL=debug`.
  - Added Zod validation for request body and db hint.
  - Closed MCP client/transport in `finally` to prevent leaks.
  - Restricted Origin header via `ALLOWED_ORIGIN`.
  - Reduced PII in logs; expanded details only in debug.
- Clerk middleware: defined `publicRoutes` and simplified matcher.
- Sidebar: prevented shortcut from triggering in inputs and added `SameSite=Lax` to state cookie.
- Tenant: validated `orgId`/db name format.
- Removed Sentry integration and configs.
- Lint script now enforces zero warnings: `eslint . --max-warnings=0`.
