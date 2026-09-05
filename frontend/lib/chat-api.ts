import { fetchAPI } from '@/lib/api'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls?: string[] | null
  created_at?: string
}

export interface ConversationItem {
  conversation_id: string
  title: string | null
  summary: string | null
  message_count: number
  created_at: string
}

export async function sendMessage(message: string, conversationId?: string) {
  return fetchAPI('/chat/message', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId }),
  })
}

export async function listConversations() {
  return fetchAPI('/chat/conversations')
}

export async function getConversationMessages(conversationId: string) {
  return fetchAPI(`/chat/conversations/${conversationId}`)
}

export async function getChatHistory(conversationId?: string) {
  const params = conversationId ? `?conversation_id=${conversationId}` : ''
  return fetchAPI(`/chat/history${params}`)
}

export async function deleteChatHistory() {
  return fetchAPI('/chat/history', { method: 'DELETE' })
}
