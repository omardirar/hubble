import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/mcp/route'

describe('GET /api/mcp', () => {
  it('returns ok status', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json).toEqual({ status: 'ok' })
  })
})
