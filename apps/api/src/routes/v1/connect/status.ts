export async function handleStatus(_request: Request, _env: unknown): Promise<Response> {
  return Response.json({ ok: true, status: "pending" })
}
