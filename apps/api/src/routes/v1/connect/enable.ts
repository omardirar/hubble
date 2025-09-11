import { startProvisioning } from "@hubble/workflows"

export async function handleEnable(request: Request, env: unknown): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}))
    await startProvisioning({ body, env })
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
}
