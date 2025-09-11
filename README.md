# Hubble Monorepo

This repository is a pnpm + Turbo monorepo containing a Next.js web app, a Cloudflare Worker, and shared packages for UI, utils, env, etc. The goal of this cleanup is to keep things strict, predictable, and easy to maintain without adding new features.

Repo Structure

- apps/web: Next.js 15 app (React 19) with Turbopack in dev, Cloudflare OpenNext build helpers
- apps/api: Cloudflare Worker (TypeScript, Wrangler)
- packages/ui: Shared UI primitives and blocks (Radix UI, lucide-react)
- packages/utils: Shared utilities (cn, fetch wrapper, errors, id)
- packages/env: Env validation (peer dep: zod)
- packages/workflows: Workflow orchestrations (placeholders)
- packages/api-contracts: API contracts (placeholders)
- packages/eslint-config: Shared ESLint flat config
- packages/prettier-config: Shared Prettier config
- packages/tsconfig: Shared TS config base

Prerequisites

- Node: >= 20.10 < 23
- pnpm: >= 9

Install

- pnpm install

Top-level Commands

- pnpm dev: Runs dev servers via Turbo (typically apps define dev)
- pnpm build: Builds all packages/apps via Turbo
- pnpm typecheck: Runs TypeScript checks across workspaces
- pnpm lint: Lints workspaces using the shared ESLint config
- pnpm test: Runs tests (vitest) where configured
- pnpm commit: Commitizen (emoji) prompt

App Commands

Web (apps/web)

- pnpm -C apps/web dev: Next.js dev (Turbopack)
- pnpm -C apps/web build: Next.js production build
- pnpm -C apps/web start: Start Next.js production server
- pnpm -C apps/web typecheck: TS typecheck only
- pnpm -C apps/web lint: Lint the app
- pnpm -C apps/web test: Run vitest for the app
- pnpm -C apps/web open-next:build: Build with OpenNext Cloudflare adapter
- pnpm -C apps/web deploy:preview|deploy:prod: Deploy via Wrangler (OpenNext)

API (apps/api)

- pnpm -C apps/api dev: Wrangler dev (local)
- pnpm -C apps/api build: Typecheck + bundle with esbuild
- pnpm -C apps/api deploy: Deploy via Wrangler
- pnpm -C apps/api typecheck: TS typecheck only
- pnpm -C apps/api lint: Lint the API sources only

Coding Standards

- ESLint: Flat config in packages/eslint-config; used repo-wide. TypeScript parser is enabled; no anonymous default exports warned in apps.
- Prettier: packages/prettier-config and root package.json `"prettier": "@hubble/prettier-config"`.
- Strict TS: Shared base in packages/tsconfig. Apps extend it and add local aliases.
- No deep imports into package sources: Enforced by `no-restricted-imports`.

UI Package Notes

- Import shared UI from `@hubble/ui` and blocks from `@hubble/ui/blocks`.
- The Tailwind preset is available at `@hubble/ui/tailwind.preset` (subpath export).

Environment

- Do not commit secrets. Use `.env.local` for development only.
- apps/web/env.d.ts lists required env vars for the web app.

Monorepo Tips

- Turbo tasks are defined in `turbo.json` (tasks: dev, build, typecheck, lint, test). Outputs are configured for Next.js and package dists for optimal caching.
- Prefer importing from published workspace entrypoints (e.g., `@hubble/utils`) rather than deep source paths.

Known Constraints

- Some dependencies have peer-range warnings with React 19 (e.g., `vaul`, `next-themes`). They may work but are out-of-range; consider upgrading those packages if issues appear.
- Several packages contain TODOs and placeholders by design (no feature changes were made during cleanup).

Conventional Commits

- Run `pnpm commit` to use the Commitizen emoji prompt.
