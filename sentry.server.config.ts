// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  // TODO: Replace hard-coded Sentry DSN with env var and document it
  //  labels: tech-debt, area:config, P2
  //  assignees: me
  //  milestone: M0 - Safety Net
  //  evidence: sentry.server.config.ts:8 — DSN literal in source
  dsn: "https://a0124d6012f3b30b4b42d1ef85904ab7@o4509848836440064.ingest.de.sentry.io/4509848965283920",

  integrations: [
    // Add the Vercel AI SDK integration to config.server.(js/ts)
    Sentry.vercelAIIntegration({
      // TODO: Gate recording inputs/outputs behind env to avoid PII in prod
      //  labels: area:observability, security, P1
      //  assignees: me
      //  milestone: M0 - Safety Net
      //  evidence: sentry.server.config.ts:13-15 — recordInputs/Outputs true by default
      recordInputs: true,
      recordOutputs: true,
    }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  // TODO: Parameterize tracesSampleRate via env; add guidance in README
  //  labels: area:config, docs, P2
  //  assignees: me
  //  milestone: M2 - Refactors
  //  evidence: sentry.server.config.ts:19 — static tracesSampleRate
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry only in debug mode
  enableLogs: process.env.LOG_LEVEL === "debug",

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.LOG_LEVEL === "debug",
})
