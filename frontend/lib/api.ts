import { supabase } from './supabase'
import type { User, RoadmapResponse, EvidenceResponse, PortfolioEntry, Opportunity, ChatSendResponse, ChatConversation } from './types'
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
const BASE = BACKEND || '/api'
export class LynksApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = body.detail
    const errObj = detail?.error
    const msg = errObj?.message ?? detail?.message ?? detail ?? `Request failed (${res.status})`
    const code = errObj?.code ?? 'unknown'
    throw new LynksApiError(code, msg)
  }
  return body as T
}
export const profile = {
  get: () => request<User>('/profile'),
  update: (fields: Partial<Pick<User, 'name' | 'age' | 'country' | 'education_level' | 'employment_status' | 'interests'>>) =>
    request<User>('/profile', { method: 'PATCH', body: JSON.stringify(fields) }),
  setCareerPath: (careerPath: string) =>
    request<{ career_path: string }>('/profile/career-path', { method: 'PATCH', body: JSON.stringify({ career_path: careerPath }) }),
}
export const roadmap = {
  get: () => request<RoadmapResponse>('/roadmap'),
  generate: () => request<RoadmapResponse>('/roadmap/generate', { method: 'POST' }),
  regenerate: () => request<RoadmapResponse>('/roadmap/regenerate', { method: 'POST' }),
}
export const evidence = {
  upload: async (taskId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await fetch(`${BASE}/tasks/${taskId}/evidence`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new LynksApiError('upload_failed', body.detail ?? 'Upload failed')
    return body as EvidenceResponse
  },
}
export const portfolio = {
  get: () => request<PortfolioEntry[]>('/portfolio'),
}
export const opportunities = {
  list: (filters?: { category?: string }) => {
    const params = new URLSearchParams()
    if (filters?.category) params.set('category', filters.category)
    const qs = params.toString()
    return request<Opportunity[]>(`/opportunities${qs ? `?${qs}` : ''}`)
  },
}
export const chat = {
  send: (message: string, conversationId?: string) =>
    request<ChatSendResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ conversation_id: conversationId, message }),
    }),
  history: (conversationId?: string) => {
    const qs = conversationId ? `?conversation_id=${conversationId}` : ''
    return request<ChatConversation>(`/chat/history${qs}`)
  },
  clear: () => request<{ success: boolean }>('/chat/history', { method: 'DELETE' }),
}
export const health = {
  check: () => request<{ status: string }>('/health'),
}