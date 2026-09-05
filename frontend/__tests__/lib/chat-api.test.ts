import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetchAPI = vi.fn()

vi.mock('@/lib/api', () => ({
  fetchAPI: mockFetchAPI,
}))

const {
  sendMessage,
  listConversations,
  getConversationMessages,
  getChatHistory,
  deleteChatHistory,
} = await import('@/lib/chat-api')

describe('Chat API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendMessage', () => {
    it('POST /chat/message with message only (new conversation)', async () => {
      mockFetchAPI.mockResolvedValue({
        conversation_id: 'conv-1',
        response: 'Hello! How can I help?',
        tool_calls: null,
        summary_updated: false,
      })

      const result = await sendMessage('Hello!')

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/message', {
        method: 'POST',
        body: { message: 'Hello!', conversation_id: null },
      })
      expect(result.conversation_id).toBe('conv-1')
      expect(result.response).toBe('Hello! How can I help?')
    })

    it('POST /chat/message with conversation_id (existing conversation)', async () => {
      mockFetchAPI.mockResolvedValue({
        conversation_id: 'conv-1',
        response: 'Here is your roadmap.',
        tool_calls: ['generate_roadmap'],
        summary_updated: true,
      })

      const result = await sendMessage('Show me my roadmap', 'conv-1')

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/message', {
        method: 'POST',
        body: { message: 'Show me my roadmap', conversation_id: 'conv-1' },
      })
      expect(result.tool_calls).toEqual(['generate_roadmap'])
      expect(result.summary_updated).toBe(true)
    })

    it('POST /chat/message with empty string', async () => {
      mockFetchAPI.mockResolvedValue({
        conversation_id: 'conv-2',
        response: 'What can I help you with?',
        tool_calls: null,
        summary_updated: false,
      })

      await sendMessage('')

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/message', {
        method: 'POST',
        body: { message: '', conversation_id: null },
      })
    })

    it('propagates API errors', async () => {
      mockFetchAPI.mockRejectedValue(new Error('Agent failed'))

      await expect(sendMessage('test')).rejects.toThrow('Agent failed')
    })
  })

  describe('listConversations', () => {
    it('GET /chat/conversations', async () => {
      mockFetchAPI.mockResolvedValue({
        conversations: [
          {
            conversation_id: 'conv-1',
            title: 'Career advice',
            summary: 'Asked about career path',
            message_count: 5,
            created_at: '2026-08-26T10:00:00Z',
          },
          {
            conversation_id: 'conv-2',
            title: null,
            summary: null,
            message_count: 1,
            created_at: '2026-08-26T11:00:00Z',
          },
        ],
      })

      const result = await listConversations()

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/conversations')
      expect(result.conversations).toHaveLength(2)
      expect(result.conversations[0].title).toBe('Career advice')
      expect(result.conversations[1].title).toBeNull()
    })

    it('returns empty array when no conversations', async () => {
      mockFetchAPI.mockResolvedValue({ conversations: [] })

      const result = await listConversations()

      expect(result.conversations).toEqual([])
    })
  })

  describe('getConversationMessages', () => {
    it('GET /chat/conversations/{id}', async () => {
      mockFetchAPI.mockResolvedValue({
        conversation_id: 'conv-1',
        summary: 'Discussed career options',
        messages: [
          { role: 'user', content: 'What career should I pick?', created_at: '2026-08-26T10:00:00Z' },
          { role: 'assistant', content: 'Let me help you with that.', tool_calls: null, created_at: '2026-08-26T10:00:05Z' },
        ],
      })

      const result = await getConversationMessages('conv-1')

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/conversations/conv-1')
      expect(result.messages).toHaveLength(2)
      expect(result.summary).toBe('Discussed career options')
    })

    it('handles conversation with tool calls', async () => {
      mockFetchAPI.mockResolvedValue({
        conversation_id: 'conv-2',
        summary: null,
        messages: [
          { role: 'user', content: 'Find internships', created_at: '2026-08-26T10:00:00Z' },
          { role: 'assistant', content: 'I found 5 opportunities.', tool_calls: { calls: ['find_opportunities'] }, created_at: '2026-08-26T10:00:10Z' },
        ],
      })

      const result = await getConversationMessages('conv-2')

      expect(result.messages[1].tool_calls).toEqual({ calls: ['find_opportunities'] })
    })

    it('propagates errors for invalid conversation ID', async () => {
      mockFetchAPI.mockRejectedValue(new Error('Conversation not found'))

      await expect(getConversationMessages('invalid-id')).rejects.toThrow('Conversation not found')
    })
  })

  describe('getChatHistory', () => {
    it('GET /chat/history without conversation_id', async () => {
      mockFetchAPI.mockResolvedValue({
        conversation_id: 'conv-1',
        messages: [{ role: 'user', content: 'Hi', created_at: '2026-08-26T10:00:00Z' }],
      })

      const result = await getChatHistory()

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/history')
      expect(result.messages).toHaveLength(1)
    })

    it('GET /chat/history with conversation_id', async () => {
      mockFetchAPI.mockResolvedValue({
        conversation_id: 'conv-2',
        messages: [],
      })

      await getChatHistory('conv-2')

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/history?conversation_id=conv-2')
    })
  })

  describe('deleteChatHistory', () => {
    it('DELETE /chat/history', async () => {
      mockFetchAPI.mockResolvedValue({ success: true })

      const result = await deleteChatHistory()

      expect(mockFetchAPI).toHaveBeenCalledWith('/chat/history', { method: 'DELETE' })
      expect(result.success).toBe(true)
    })

    it('propagates errors', async () => {
      mockFetchAPI.mockRejectedValue(new Error('Cannot delete'))

      await expect(deleteChatHistory()).rejects.toThrow('Cannot delete')
    })
  })
})
