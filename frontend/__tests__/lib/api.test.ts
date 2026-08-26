import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()
const mockRefreshSession = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  },
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

const { fetchAPI } = await import('@/lib/api')

describe('fetchAPI', () => {
  const mockToken = 'test-jwt-token-123'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: mockToken } },
    })
    mockRefreshSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed-token' } },
    })
  })

  describe('auth header injection', () => {
    it('includes Authorization header when session exists', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      await fetchAPI('/chat/conversations')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/conversations'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      )
    })

    it('throws "Not authenticated" when no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })

      await expect(fetchAPI('/chat/conversations')).rejects.toThrow('Not authenticated')
    })

    it('sets Content-Type to application/json', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await fetchAPI('/chat/message', {
        method: 'POST',
        body: { message: 'hi' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      )
    })
  })

  describe('request methods', () => {
    it('defaults to GET', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

      await fetchAPI('/chat/conversations')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('sends POST with JSON body', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

      await fetchAPI('/chat/message', {
        method: 'POST',
        body: { message: 'hello', conversation_id: 'conv-1' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/message'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'hello', conversation_id: 'conv-1' }),
        }),
      )
    })

    it('sends DELETE with no body', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) })

      await fetchAPI('/chat/history', { method: 'DELETE' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/history'),
        expect.objectContaining({ method: 'DELETE', body: undefined }),
      )
    })
  })

  describe('token refresh on 401', () => {
    it('refreshes token and retries on 401', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'Unauthorized' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: 'ok' }) })

      const result = await fetchAPI('/chat/conversations')

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ data: 'ok' })
    })

    it('throws error if refresh also fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Unauthorized' }),
      })
      mockRefreshSession.mockResolvedValue({ data: { session: null } })

      await expect(fetchAPI('/chat/conversations')).rejects.toThrow()
    })
  })

  describe('error handling', () => {
    it('throws error message from response detail', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'Conversation not found' }),
      })

      await expect(fetchAPI('/chat/conversations/nonexistent')).rejects.toThrow('Conversation not found')
    })

    it('throws error from nested detail.message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: { message: 'Agent failed', code: 'agent_error' } }),
      })

      await expect(fetchAPI('/chat/message')).rejects.toThrow('Agent failed')
    })

    it('falls back to statusText when body parsing fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('parse error')),
      })

      await expect(fetchAPI('/chat/message')).rejects.toThrow('Bad Gateway')
    })

    it('falls back to generic message when detail is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      })

      await expect(fetchAPI('/chat/message')).rejects.toThrow('Internal Server Error')
    })
  })

  describe('URL construction', () => {
    it('uses NEXT_PUBLIC_BACKEND_URL env var', async () => {
      const original = process.env.NEXT_PUBLIC_BACKEND_URL
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://custom-backend.example.com'

      vi.resetModules()
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'token' } } })
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

      const { fetchAPI: freshFetch } = await import('@/lib/api')
      await freshFetch('/chat/message')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom-backend.example.com/chat/message',
        expect.any(Object),
      )

      process.env.NEXT_PUBLIC_BACKEND_URL = original
      vi.resetModules()
    })

    it('falls back to Railway URL when env var is not set', async () => {
      const original = process.env.NEXT_PUBLIC_BACKEND_URL
      delete process.env.NEXT_PUBLIC_BACKEND_URL

      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })

      await fetchAPI('/health')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://lynks-backend-production.up.railway.app/health',
        expect.any(Object),
      )

      process.env.NEXT_PUBLIC_BACKEND_URL = original
    })
  })
})
