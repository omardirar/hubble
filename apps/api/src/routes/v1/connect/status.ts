import { createServiceClientFromSecrets } from "@hubble/db"
import type { SecretsStoreEnv } from "@hubble/env"

export async function handleStatus(request: Request, env: SecretsStoreEnv): Promise<Response> {
  try {
    const url = new URL(request.url)
    const jobId = url.searchParams.get("jobId")

    if (!jobId) {
      return Response.json(
        {
          ok: false,
          error: "Missing jobId parameter",
        },
        { status: 400 },
      )
    }

    const supabase = await createServiceClientFromSecrets(env)
    const { data: job, error } = await supabase
      .from("provisioning_jobs")
      .select("id, status, payload, created_at, updated_at")
      .eq("id", jobId)
      .single()

    if (error) {
      return Response.json(
        {
          ok: false,
          error: `Job not found: ${error.message}`,
        },
        { status: 404 },
      )
    }

    return Response.json({
      ok: true,
      jobId: job.id,
      status: job.status,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })
  } catch (error) {
    console.error("Status endpoint error:", error)
    return Response.json(
      {
        ok: false,
        error: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
