# Repository Guidelines

## Project Structure & Module Organization

- `apps/web` — Next.js app targeting Cloudflare (OpenNext + Wrangler).
- `apps/api` — Cloudflare Worker API and queue/workflow endpoints.
- `packages/*` — shared TypeScript libs: `ui`, `utils`, `db`, `env`, `auth`, `workflows`, `api-contracts`, plus shared configs (`eslint-config`, `prettier-config`, `tsconfig`).
- `infra/*` — deployment/config for Cloudflare and Supabase.
- `docs/*`, `.github/workflows/*` — docs and CI.

## Build, Test, and Development Commands

- `pnpm dev` — start all dev targets via Turbo.
- `pnpm --filter @hubble/web dev` — run the web app locally.
- `pnpm --filter @hubble/api dev` — run the API with Wrangler locally.
- `pnpm lint | typecheck | build | test` — run repo-wide tasks.
- `pnpm --filter @hubble/web test` — run Vitest for the web app.
- `pnpm --filter @hubble/web deploy:preview` — preview deploy (CI preferred).
- Requirements: Node 20.x, pnpm 9.x (see `package.json` engines).

## Coding Style & Naming Conventions

- Language: TypeScript with ES modules.
- Formatting: Prettier (`@hubble/prettier-config`), 2-space indent, LF, UTF-8 (`.editorconfig`).
- Linting: ESLint (`@hubble/eslint-config`). Run `pnpm lint` before pushing.
- Naming: camelCase for variables/functions; PascalCase for React components; prefer kebab-case file names. Component files may use PascalCase when exporting a single component.

## Testing Guidelines

- Framework: Vitest (+ Testing Library) in `apps/web`.
- File names: `*.test.ts` / `*.test.tsx`; colocate near source or use `__tests__`.
- Commands: `pnpm test` (all) or `pnpm --filter @hubble/web test`.
- Aim for meaningful coverage on critical UI logic and routes; add tests to packages as they grow.

## Commit & Pull Request Guidelines

- Commits: use Commitizen with gitmoji — `pnpm commit` (e.g., `✨ feat: add workspace switcher`).
- PRs: include a clear description, linked issues, and screenshots for UI changes. Ensure CI passes: `lint`, `typecheck`, `build`, `test`.
- Inline TODOs follow the required format in `CONTRIBUTING.md` (auto-creates issues and closes when resolved).

## Security & Configuration Tips

- Copy `.env.example` to your local env; never commit secrets. Use Wrangler/Cloudflare and project secrets for deployment.
- Supabase and Cloudflare details live under `infra/*`. Keep credentials out of code and follow least-privilege principles.
