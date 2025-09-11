// TODO: Thin handlers; call @hubble/workflows + @hubble/db
//   Context: Move orchestration logic into @hubble/workflows and persistence to @hubble/db.
//   labels: area/web, feature/connect, type/tech-debt
//   assignees: omzification
//   milestone: 0.0.1
import { NextResponse } from "next/server"

export async function POST() {
  // TODO: Invoke @hubble/workflows.startProvisioning and persist via @hubble/db
  //   Context: Kick off provisioning saga and record job status.
  //   labels: area/web, feature/connect, type/feature
  //   assignees: omzification
  //   milestone: 0.0.1
  return NextResponse.json({ ok: true, message: "connect endpoint stub" })
}
