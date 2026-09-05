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
  is_pinned: boolean
}

export async function sendMessage(message: string, conversationId?: string) {
  return fetchAPI<{ message_id: string; response: string; conversation_id: string; tool_calls?: { name: string }[]; summary_updated?: boolean }>('/chat/message', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId }),
  })
}

export async function listConversations() {
  return fetchAPI<{ conversations: ConversationItem[] }>('/chat/conversations')
}

export async function getConversationMessages(conversationId: string) {
  return fetchAPI<{ messages: ChatMessage[] }>(`/chat/conversations/${conversationId}`)
}

export async function getChatHistory(conversationId?: string) {
  const params = conversationId ? `?conversation_id=${conversationId}` : ''
  return fetchAPI<{ messages: ChatMessage[] }>(`/chat/history${params}`)
}

export async function deleteChatHistory() {
  return fetchAPI<{ success: boolean }>('/chat/history', { method: 'DELETE' })
}

export async function togglePinConversation(conversationId: string) {
  return fetchAPI<{ conversation_id: string; is_pinned: boolean }>(`/chat/conversations/${conversationId}`, { method: 'PATCH' })
}

export async function deleteConversation(conversationId: string) {
  return fetchAPI<{ success: boolean }>(`/chat/conversations/${conversationId}`, { method: 'DELETE' })
}
