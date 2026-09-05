import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Backend Endpoint Coverage Test
 *
 * Tests that the frontend API layer correctly maps to all backend endpoints.
 * Uses the live backend URL to verify contract shapes (not live calls — all mocked).
 *
 * Backend routes (from api/routes/*.py):
 *   /profile, /profile/career-path
 *   /roadmap, /roadmap/generate, /roadmap/regenerate
 *   /portfolio
 *   /opportunities, /opportunities/{id}/save, /opportunities/saved
 *   /resume
 *   /chat/message, /chat/history, /chat/conversations, /chat/conversations/{id}
 *   /memory, /memory/{id}
 *   /notifications, /notifications/{id}, /notifications/read-all, /notifications/unread/count, /notifications/new-count
 */

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
const chatApi = await import('@/lib/chat-api')

describe('Backend Endpoint Coverage', () => {
  const token = 'test-token'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: token } } })
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'new-token' } } })
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
  })

  // ─── Profile ───────────────────────────────────────────────────────────────
  describe('Profile', () => {
    it('GET /profile', async () => {
      await fetchAPI('/profile')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('PATCH /profile', async () => {
      await fetchAPI('/profile', { method: 'PATCH', body: { name: 'Jordan' } })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('PATCH /profile/career-path', async () => {
      await fetchAPI('/profile/career-path', { method: 'PATCH', body: { career_path: 'Software Engineering' } })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profile/career-path'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })
  })

  // ─── Roadmap ───────────────────────────────────────────────────────────────
  describe('Roadmap', () => {
    it('GET /roadmap', async () => {
      await fetchAPI('/roadmap')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/roadmap'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('POST /roadmap/generate', async () => {
      await fetchAPI('/roadmap/generate', { method: 'POST' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/roadmap/generate'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('POST /roadmap/regenerate', async () => {
      await fetchAPI('/roadmap/regenerate', { method: 'POST' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/roadmap/regenerate'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  // ─── Portfolio ─────────────────────────────────────────────────────────────
  describe('Portfolio', () => {
    it('GET /portfolio', async () => {
      await fetchAPI('/portfolio')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/portfolio'),
        expect.objectContaining({ method: 'GET' }),
      )
    })
  })

  // ─── Opportunities ─────────────────────────────────────────────────────────
  describe('Opportunities', () => {
    it('GET /opportunities', async () => {
      await fetchAPI('/opportunities')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/opportunities'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('GET /opportunities with category filter', async () => {
      await fetchAPI('/opportunities?category=competition')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/opportunities?category=competition'),
        expect.any(Object),
      )
    })

    it('GET /opportunities/saved', async () => {
      await fetchAPI('/opportunities/saved')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/opportunities/saved'),
        expect.any(Object),
      )
    })

    it('DELETE /opportunities/{id}/save (unsave)', async () => {
      await fetchAPI('/opportunities/opp-1/save', { method: 'DELETE' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/opportunities/opp-1/save'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  // ─── Resume ────────────────────────────────────────────────────────────────
  describe('Resume', () => {
    it('GET /resume', async () => {
      await fetchAPI('/resume')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/resume'),
        expect.objectContaining({ method: 'GET' }),
      )
    })
  })

  // ─── Chat ──────────────────────────────────────────────────────────────────
  describe('Chat', () => {
    it('POST /chat/message (new conversation)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversation_id: 'conv-1', response: 'Hi!' }),
      })

      await chatApi.sendMessage('Hello')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/message'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'Hello', conversation_id: null }),
        }),
      )
    })

    it('POST /chat/message (existing conversation)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversation_id: 'conv-1', response: 'Got it.' }),
      })

      await chatApi.sendMessage('Tell me more', 'conv-1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/message'),
        expect.objectContaining({
          body: JSON.stringify({ message: 'Tell me more', conversation_id: 'conv-1' }),
        }),
      )
    })

    it('GET /chat/conversations', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversations: [] }),
      })

      await chatApi.listConversations()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/conversations'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('GET /chat/conversations/{id}', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversation_id: 'conv-1', messages: [] }),
      })

      await chatApi.getConversationMessages('conv-1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/conversations/conv-1'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('GET /chat/history', async () => {
      await chatApi.getChatHistory()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/history'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('GET /chat/history?conversation_id=conv-1', async () => {
      await chatApi.getChatHistory('conv-1')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/history?conversation_id=conv-1'),
        expect.any(Object),
      )
    })

    it('DELETE /chat/history', async () => {
      await chatApi.deleteChatHistory()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/history'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  // ─── Memory ────────────────────────────────────────────────────────────────
  describe('Memory', () => {
    it('GET /memory', async () => {
      await fetchAPI('/memory')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('PATCH /memory/{id}', async () => {
      await fetchAPI('/memory/mem-1', { method: 'PATCH', body: { is_pinned: true } })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/mem-1'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('DELETE /memory/{id}', async () => {
      await fetchAPI('/memory/mem-1', { method: 'DELETE' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/memory/mem-1'),
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
  })

  // ─── Notifications ─────────────────────────────────────────────────────────
  describe('Notifications', () => {
    it('GET /notifications', async () => {
      await fetchAPI('/notifications')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('POST /notifications', async () => {
      await fetchAPI('/notifications', {
        method: 'POST',
        body: { title: 'Test', message: 'Body', notification_type: 'info' },
      })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('GET /notifications/{id}', async () => {
      await fetchAPI('/notifications/notif-1')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/notif-1'),
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('PATCH /notifications/{id}/read', async () => {
      await fetchAPI('/notifications/notif-1/read', { method: 'PATCH' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/notif-1/read'),
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('POST /notifications/read-all', async () => {
      await fetchAPI('/notifications/read-all', { method: 'POST' })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/read-all'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('GET /notifications/unread/count', async () => {
      await fetchAPI('/notifications/unread/count')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/unread/count'),
        expect.any(Object),
      )
    })

    it('GET /notifications/new-count', async () => {
      await fetchAPI('/notifications/new-count')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/new-count'),
        expect.any(Object),
      )
    })
  })

  // ─── Auth flow ─────────────────────────────────────────────────────────────
  describe('Auth Flow', () => {
    it('always sends Authorization header with JWT', async () => {
      await fetchAPI('/chat/conversations')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        }),
      )
    })

    it('refreshes on 401 and retries', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ detail: 'Unauthorized' }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ conversations: [] }) })

      await fetchAPI('/chat/conversations')

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
