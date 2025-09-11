import { createServiceClient } from "@hubble/db"

// TODO: Orchestrate steps with Cloudflare Workflows
//   Context: Model provisioning as a saga with retries and compensation; emit progress events.
//   labels: area/workflows, feature/provisioning, type/feature
//   assignees: omzification
//   milestone: 0.0.1
export async function startProvisioning(args: { body: unknown; env: unknown }) {
  // TODO: Invoke Workflows APIs to run a saga
  //   Context: Call Cloudflare Workflows, return job id, and persist status via @hubble/db.
  //   labels: area/workflows, feature/provisioning, type/feature
  //   assignees: omzification
  //   milestone: 0.0.1

  try {
    const supabase = createServiceClient()

    // Create provisioning job record
    const { data: job, error } = await supabase
      .from("provisioning_jobs")
      .insert({
        status: "pending",
        payload: args.body,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create provisioning job: ${error.message}`)
    }

    // TODO: Start Cloudflare Workflow here
    // Issue URL: https://github.com/omzification/hubble/issues/101
    // For now, just return the job ID
    return { jobId: job.id, status: "pending" }
  } catch (error) {
    console.error("Provisioning failed:", error)
    throw error
  }
}
