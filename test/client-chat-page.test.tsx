/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClientChatPage from '@/app/(protected)/chat/page_client'

vi.mock('@/components/chat/ChatSidebar', () => ({
  ChatSidebar: () => <div data-testid="sidebar" />,
}))

vi.mock('@/components/chat/ChatConversation', () => ({
  ChatConversation: ({ messages }: any) => (
    <div data-testid="conversation">{messages.map((m: any) => m.text).join(',')}</div>
  ),
}))

vi.mock('@/components/ai-elements/prompt-input', () => ({
  PromptInput: ({ onSubmit, children }: any) => <form onSubmit={onSubmit}>{children}</form>,
  PromptInputTextarea: (props: any) => <textarea {...props} />,
  PromptInputToolbar: ({ children }: any) => <div>{children}</div>,
  PromptInputTools: () => <div />,
  PromptInputSubmit: (props: any) => <button type="submit" {...props} />,
}))

const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  // @ts-expect-error override
  global.fetch = fetchMock
})

describe('ClientChatPage', () => {
  it('sends a message and displays reply', async () => {
    fetchMock.mockImplementation((url: any, opts: any) => {
      if (url === '/api/chat/conversations') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'c1' }) })
      }
      if (url === '/api/chat/messages/c1' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, text: async () => '' })
      }
      if (url === '/api/chat/messages/c1' && (!opts || opts.method === 'GET')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 'm1', role: 'user', text: 'hello' }] })
      }
      if (url === '/api/chat') {
        return Promise.resolve({ ok: true, json: async () => ({ reply: 'hi there' }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(<ClientChatPage />)
    const textarea = screen.getByPlaceholderText('Say something...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.submit(textarea.closest('form')!)

    await waitFor(() => expect(screen.getByTestId('conversation').textContent).toContain('hi there'))
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/messages/c1', expect.anything())
  })
})
