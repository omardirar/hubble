// Cloudflare adapter handles runtime; avoid forcing edge at route level per OpenNext docs

export async function GET() {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}
