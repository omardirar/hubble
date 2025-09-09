/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadMessages } from './chat'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  // @ts-expect-error override
  global.fetch = mockFetch
})

describe('loadMessages', () => {
  it('filters system messages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: '1', role: 'system', text: 's' },
        { id: '2', role: 'user', text: 'u' },
      ],
    } as any)
    const msgs = await loadMessages('abc')
    expect(msgs).toEqual([{ id: '2', role: 'user', text: 'u' }])
  })

  it('throws on non-ok responses with body text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'bad',
      statusText: 'Bad',
    } as any)
    await expect(loadMessages('abc')).rejects.toThrow('bad')
  })
})
