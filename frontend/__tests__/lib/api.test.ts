import { describe, it, expect, vi, beforeEach } from 'vitest'
import { profile, roadmap, evidence, portfolio, opportunities, chat, health, LynksApiError } from '@/lib/api'
import { supabase } from '@/lib/supabase'

describe('Lynks API Client', () => {
  const mockToken = 'test-jwt-token-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('request() — auth header injection', () => {
    it('includes Authorization header when session exists', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      await health.check()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      )
    })

    it('omits Authorization header when no session', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      await health.check()

      const callHeaders = vi.mocked(global.fetch).mock.calls[0]?.[1]?.headers as Record<string, string>
      expect(callHeaders?.Authorization).toBeUndefined()
    })

    it('does not set Content-Type for FormData bodies', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: '1', file_url: 'test' }),
      })

      const fakeFile = new File(['test'], 'test.png', { type: 'image/png' })
      await evidence.upload('task-123', fakeFile)

      const callHeaders = vi.mocked(global.fetch).mock.calls[0]?.[1]?.headers as Record<string, string>
      expect(callHeaders?.['Content-Type']).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('throws LynksApiError on non-2xx response', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          detail: { error: { code: 'not_found', message: 'Profile not found' } },
        }),
      })

      await expect(profile.get()).rejects.toThrow(LynksApiError)
    })

    it('extracts error code from nested response', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          detail: { error: { code: 'unauthorized', message: 'Invalid token' } },
        }),
      })

      try {
        await profile.get()
      } catch (e) {
        expect(e).toBeInstanceOf(LynksApiError)
        expect((e as LynksApiError).code).toBe('unauthorized')
      }
    })
  })

  describe('profile API', () => {
    it('GET /profile returns user data', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      const mockUser = { user_id: '1', name: 'Test User', email: 'test@test.com', interests: [] }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      })

      const result = await profile.get()
      expect(result).toEqual(mockUser)
      expect(global.fetch).toHaveBeenCalledWith('/api/profile', expect.any(Object))
    })

    it('PATCH /profile sends correct body', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user_id: '1', name: 'Updated' }),
      })

      await profile.update({ name: 'Updated' })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated' }),
        })
      )
    })

    it('PATCH /profile/career-path sends career_path', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ career_path: 'Software Engineering' }),
      })

      await profile.setCareerPath('Software Engineering')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/profile/career-path',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ career_path: 'Software Engineering' }),
        })
      )
    })
  })

  describe('roadmap API', () => {
    it('POST /roadmap/generate sends POST method', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ roadmap_id: 'rm-1', steps: [] }),
      })

      const result = await roadmap.generate()
      expect(result.roadmap_id).toBe('rm-1')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/roadmap/generate',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('GET /roadmap returns roadmap data', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      const mockRoadmap = { roadmap_id: 'rm-1', steps: [{ step_id: 's1', title: 'Step 1' }] }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRoadmap),
      })

      const result = await roadmap.get()
      expect(result.steps).toHaveLength(1)
    })
  })

  describe('opportunities API', () => {
    it('GET /opportunities without filters', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      await opportunities.list()
      expect(global.fetch).toHaveBeenCalledWith('/api/opportunities', expect.any(Object))
    })

    it('GET /opportunities?category=competition with filter', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      await opportunities.list({ category: 'competition' })
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/opportunities?category=competition',
        expect.any(Object)
      )
    })
  })

  describe('chat API', () => {
    it('POST /chat/message sends message and conversation_id', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversation_id: 'conv-1', response: 'Hello!' }),
      })

      const result = await chat.send('Hello!', 'conv-1')
      expect(result.conversation_id).toBe('conv-1')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat/message',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ conversation_id: 'conv-1', message: 'Hello!' }),
        })
      )
    })

    it('GET /chat/history with conversation_id', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ conversation_id: 'conv-1', messages: [] }),
      })

      await chat.history('conv-1')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat/history?conversation_id=conv-1',
        expect.any(Object)
      )
    })

    it('DELETE /chat/history clears conversation', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

      const result = await chat.clear()
      expect(result.success).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat/history',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('evidence API', () => {
    it('POST /tasks/{id}/evidence sends FormData', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: { access_token: mockToken } },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'ev-1', file_url: 'https://example.com/file.png' }),
      })

      const fakeFile = new File(['content'], 'evidence.png', { type: 'image/png' })
      const result = await evidence.upload('task-123', fakeFile)

      expect(result.file_url).toBe('https://example.com/file.png')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tasks/task-123/evidence',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('health API', () => {
    it('GET /health returns status ok', async () => {
      supabase.auth.getSession = vi.fn().mockResolvedValue({
        data: { session: null },
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      const result = await health.check()
      expect(result.status).toBe('ok')
    })
  })
})
