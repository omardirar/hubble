import { handleEnable } from "./routes/v1/connect/enable"
import { handleStatus } from "./routes/v1/connect/status"

export interface Env {}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url

  if (pathname.startsWith("/v1/connect/enable")) {
    return handleEnable(request, env)
  }
  if (pathname.startsWith("/v1/connect/status")) {
    return handleStatus(request, env)
  }

  return new Response("Not found", { status: 404 })
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => route(request, env, ctx),
}
