import { fetchAPI } from '@/lib/api'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  tool_calls?: { calls: string[] } | null
  created_at?: string
}

export interface ConversationItem {
  conversation_id: string
  title: string | null
  summary: string | null
  message_count: number
  created_at: string
}

export interface SendMessageResponse {
  conversation_id: string
  response: string
  tool_calls?: string[]
  summary_updated?: boolean
}

export async function sendMessage(message: string, conversationId?: string): Promise<SendMessageResponse> {
  return fetchAPI('/chat/message', {
    method: 'POST',
    body: { message, conversation_id: conversationId || null },
  })
}

export async function listConversations(): Promise<{ conversations: ConversationItem[] }> {
  return fetchAPI('/chat/conversations')
}

export async function getConversationMessages(
  conversationId: string,
): Promise<{ conversation_id: string; summary: string | null; messages: ChatMessage[] }> {
  return fetchAPI(`/chat/conversations/${conversationId}`)
}

export async function getChatHistory(conversationId?: string): Promise<{ conversation_id: string; messages: ChatMessage[] }> {
  const params = conversationId ? `?conversation_id=${conversationId}` : ''
  return fetchAPI(`/chat/history${params}`)
}

export async function deleteChatHistory(): Promise<{ success: boolean }> {
  return fetchAPI('/chat/history', { method: 'DELETE' })
}
