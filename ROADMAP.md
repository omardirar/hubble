# Hubble Modernization Roadmap

Milestones at a glance

- M0 - Safety Net (due: 2025-09-17)
- M1 - Baseline Tests (due: 2025-10-01)
- M2 - Refactors (due: 2025-10-29)
- M3 - Perf & DX (due: 2025-11-26)

## M0 - Safety Net

Goals: Reduce immediate risk, secure configuration, and add guardrails.

- [ ] Replace hard-coded Sentry DSN with env var and document it — sentry.server.config.ts (labels: tech-debt, area:config, P2; assignees: me; due: 2025-09-17)
- [ ] Replace hard-coded Sentry DSN with env var and document it — sentry.edge.config.ts (labels: tech-debt, area:config, P2; assignees: me; due: 2025-09-17)
- [ ] Add per-user rate limiting (e.g., Upstash Redis) in chat API — src/app/api/chat/route.ts (labels: area:api, security, P1; assignees: me; due: 2025-09-17)
- [ ] Provide a .env.example with placeholder variables matching env.d.ts — README.md (labels: docs, area:config, P2; assignees: me; due: 2025-09-17)
- [ ] Implement per-user limiter and document env/setup — README.md (labels: area:api, security, P1; assignees: me; due: 2025-09-17)
- [ ] Add npm script for dependency audit (npm audit / osv-scanner) — package.json (labels: security, area:build, P2; assignees: me; due: 2025-09-17)

## M1 - Baseline Tests

Goals: Establish reliable tests for critical auth/tenant/LLM flows.

- [ ] Tighten message schema to validated UIMessage shape; cap total tokens — src/app/api/chat/route.ts (labels: area:api, testing, P2; assignees: me; due: 2025-10-01)
- [ ] Define consistent error response shape and map in UI error states — README.md (labels: area:api, area:ui, P2; assignees: me; due: 2025-10-01)

## M2 - Refactors

Goals: Improve structure and developer experience.

- [ ] Parameterize tracesSampleRate via env; add guidance in README — sentry.server.config.ts (labels: area:config, docs, P2; assignees: me; due: 2025-10-29)
- [ ] Parameterize tracesSampleRate via env; add guidance in README — sentry.edge.config.ts (labels: area:config, docs, P2; assignees: me; due: 2025-10-29)
- [ ] Extract ChatService to separate file for unit testing stream orchestration — src/app/api/chat/route.ts (labels: tech-debt, testing, area:api, P1; assignees: me; due: 2025-10-29)
- [ ] Document global header visibility and add ADR for layout decisions — src/app/layout.tsx (labels: docs, area:ui, P3; assignees: me; due: 2025-10-29)
- [ ] Add sequence diagram for Chat flow — README.md (labels: docs, area:api, P3; assignees: me; due: 2025-10-29)

## M3 - Perf & DX

Goals: Performance profiling, a11y, and developer tooling.

- [ ] Cache MCP tool list per request/server to reduce latency — src/app/api/chat/route.ts (labels: perf, area:api, P3; assignees: me; due: 2025-11-26)
- [ ] Add keyboard shortcut docs and setting for sidebar toggle — src/components/ui/sidebar.tsx (labels: docs, area:ui, P3; assignees: me; due: 2025-11-26)
- [ ] Review dark mode contrast ratios with axe-core — src/app/globals.css (labels: accessibility, area:ui, P3; assignees: me; due: 2025-11-26)
- [ ] a11y: ensure headings order & landmark roles in markdown render — src/components/ai-elements/response.tsx (labels: area:ui, accessibility, P3; assignees: me; due: 2025-11-26)

## How Issues are Generated

This repo uses `alstr/todo-to-issue-action@v5` to convert inline TODOs into GitHub issues. On push to `main` (or via manual dispatch), the workflow scans the codebase for TODOs and creates/updates issues. Ensure the repository has “Read and write permissions” enabled under Settings → Actions → Workflow permissions so the workflow can create issues.
