// TODO: Define zod schemas for enable/status
//   Context: Provide request/response validation types for connect APIs; publish via @hubble/api-contracts.
//   labels: area/contracts, feature/connect, type/feature
//   assignees: omzification
//   milestone: 0.0.1
// TODO: Fill in EnableRequest fields
//   Context: Define the request payload for enabling connections; align with the API route contract.
//   labels: area/contracts, feature/connect, type/feature
//   assignees: omzification
//   milestone: 0.0.1
export type EnableRequest = {
  /* fields TBD */
}
export type EnableResponse = { ok: boolean }
export type StatusResponse = { ok: boolean; status: string }
