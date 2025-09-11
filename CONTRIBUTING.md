### Inline TODOs → Issues

Use this required format for inline TODOs/FIXMEs. The workflow will create issues for newly added items on the default branch, insert the created issue URL back into the comment, and auto-close when the TODO is removed.

```md
TODO: Short, imperative title
Context: one or two lines of why/intent
labels: area/<x>, feature/<y>, type/<z>
assignees: omzification
milestone: 0.x.x
```

Rules:

- Title must be short and imperative, followed by a brief Context block.
- Always include labels across families: area/…, feature/…, type/….
- Always include assignees (default to `omzification`).
- Always include a milestone in the 0.x.x series (start at 0.0.1).
- `@user`, `!label`, `#123`, `scope` behave per the action docs (missing labels/milestones are auto-created).
- The workflow runs on pushes to the default branch. Use “Run workflow” with `MANUAL_COMMIT_REF` and optional `MANUAL_BASE_REF` to backfill.

Notes:

- Multiple issues can be created if both `push` and `pull_request` triggers are enabled. We only trigger on `push` and guard for default branch to avoid duplicates. Enabling URL insertion further reduces duplicates.
- Markdown code blocks inside Markdown files: GitHub wraps issue bodies in backticks. For nested code blocks, prefer using `~` as a delimiter to avoid formatting issues.
- TODO Options: Only one `reference` is supported. Additional configuration goes under the body using `name: value` lines (each option on its own line beneath the TODO and Context).

### Version Bumps → Automated Release

When the root `package.json` version changes, a CI workflow creates a changelog, tag, and GitHub Release.

- Trigger: Push to the default branch whose head commit message contains `bump:` (or run manually via “Run workflow”).
- Guardrails: The job only runs on the default branch; changelog commits include `[skip ci]` to avoid loops.
- What it does:
  - Detects if `package.json` version differs from the latest tag.
  - Generates incremental changelog with Commitizen (`cz_gitmoji`).
  - Commits `CHANGELOG.md`, pushes, creates a tag matching the version, and publishes a GitHub Release with notes.

Developer flow:

1. Bump the root version (edit `package.json`) and commit with a message that includes `bump:` (you can use `pnpm commit` for gitmoji formatting).
2. Push to the default branch.
3. CI will generate/update `CHANGELOG.md`, tag the commit, and publish a Release.
