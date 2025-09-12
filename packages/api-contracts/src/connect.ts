// TODO: Define zod schemas and EnableRequest fields for connect APIs
// Issue URL: https://github.com/omzification/hubble/issues/100
//   Context: Provide request/response validation types and define request payload for enabling connections.
//   labels: area/contracts, feature/connect, type/feature
//   assignees: omzification
//   milestone: 0.0.1
export type EnableRequest = {
  /* fields TBD */
}
export type EnableResponse = { ok: boolean }
export type StatusResponse = { ok: boolean; status: string }
