Remaining tasks

- Add rate limiting to `/api/chat` (per-user; Upstash Redis) and 429 handling.
- Introduce structured logging with redaction (e.g., pino) and `LOG_LEVEL` gates.
- Add security headers (CSP via `headers()`; `X-Content-Type-Options: nosniff`).
- Tests
  - `src/lib/jwt.ts`: RSA key variants, expiry, claims
  - `src/lib/tenant.ts`: format validation, hint mismatch
  - `src/app/api/chat/route.ts`: auth/tenant errors, tool discovery, fallback path
  - UI: sidebar hotkey behavior and cookie persistence; tool UI rendering
