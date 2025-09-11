import { startProvisioning } from "@hubble/workflows"

export async function handleEnable(request: Request, env: unknown): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await startProvisioning({ body, env })

    return Response.json({
      ok: true,
      jobId: result.jobId,
      status: result.status,
      message: "Provisioning started successfully",
    })
  } catch (error) {
    console.error("Enable endpoint error:", error)
    return Response.json(
      {
        ok: false,
        error: (error as Error).message,
      },
      { status: 500 },
    )
  }
}
