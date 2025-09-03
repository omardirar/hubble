import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { dynamicTool, jsonSchema } from '@ai-sdk/provider-utils'

export async function connectMcp({
  mcpUrl,
  jwt,
  dbName,
  origin,
}: {
  mcpUrl: string
  jwt: string
  dbName: string
  origin?: string
}) {
  const client = new Client({ name: 'hubble-chat', version: '1.0.0' }, { capabilities: {} as import('@modelcontextprotocol/sdk/types.js').ClientCapabilities })
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Db-Name': dbName,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(origin ? { Origin: origin } : {}),
      },
    },
  })
  await client.connect(transport)

  const list = await client.listTools()
  const tools = Object.fromEntries(
    (list.tools ?? []).map((t) => {
      const tName = t.name
      const tDesc = t.description || ''
      const tTool = dynamicTool({
        description: tDesc,
        inputSchema: jsonSchema(
          (t as { inputSchema?: unknown })?.inputSchema ?? { type: 'object', properties: {}, required: [] },
        ),
        execute: async (args: unknown) => {
          const safeArgs: Record<string, unknown> =
            args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
          const result = await client.callTool({ name: tName, arguments: safeArgs })
          const texts: string[] = []
          const contentArray = (result as { content?: unknown })?.content
          if (Array.isArray(contentArray)) {
            for (const c of contentArray as Array<unknown>) {
              if (
                c &&
                typeof c === 'object' &&
                'type' in c &&
                (c as { type?: unknown }).type === 'text' &&
                'text' in c &&
                typeof (c as { text?: unknown }).text === 'string'
              ) {
                texts.push((c as { text: string }).text)
              }
            }
          }
          return texts.length > 0 ? texts.join('\n\n') : result
        },
      })
      return [tName, tTool]
    }),
  )

  return { client, tools }
}
