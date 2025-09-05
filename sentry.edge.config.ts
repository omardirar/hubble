// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  // TODO: Replace hard-coded Sentry DSN with env var and document it
  //  labels: tech-debt, area:config, P2
  //  assignees: me
  //  milestone: M0 - Safety Net
  //  evidence: sentry.edge.config.ts:9 — DSN literal in source
  dsn: "https://a0124d6012f3b30b4b42d1ef85904ab7@o4509848836440064.ingest.de.sentry.io/4509848965283920",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  // TODO: Parameterize tracesSampleRate via env; add guidance in README
  //  labels: area:config, docs, P2
  //  assignees: me
  //  milestone: M2 - Refactors
  //  evidence: sentry.edge.config.ts:12 — static tracesSampleRate
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry only in debug mode
  enableLogs: process.env.LOG_LEVEL === "debug",

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.LOG_LEVEL === "debug",
})
