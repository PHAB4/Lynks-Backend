// API client for Lynks backend — matches their FastAPI endpoints
import { supabase } from './supabase'
import type { User, RoadmapResponse, EvidenceResponse, PortfolioEntry, Opportunity, ResumeResponse, ChatSendResponse, ChatConversation } from './types'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://lynks-backend-production.up.railway.app'
const BASE = BACKEND

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

export async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, options)
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
  list: async (filters?: { category?: string; sort?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams()
    if (filters?.category && filters.category !== 'All') params.set('category', filters.category)
    if (filters?.sort) params.set('sort', filters.sort)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.limit) params.set('limit', String(filters.limit))
    const qs = params.toString()
    const res = await request<{ opportunities: Opportunity[]; metadata: { total_available: number; returned: number; page: number; total_pages: number } }>(`/opportunities${qs ? `?${qs}` : ''}`)
    return res
  },
  matches: async (page?: number, limit?: number) => {
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    const qs = params.toString()
    const res = await request<{ opportunities: Opportunity[]; metadata: Record<string, unknown> }>(`/opportunities/matches${qs ? `?${qs}` : ''}`)
    return res
  },
  refresh: async () => {
    const res = await request<{ opportunities: Opportunity[]; metadata: Record<string, unknown> }>('/opportunities/refresh', { method: 'POST' })
    return res
  },
  saved: async () => {
    const res = await request<{ saved: Opportunity[]; total: number }>('/opportunities/saved')
    return res
  },
  save: (id: string) => request<{ success: boolean }>(`/opportunities/${id}/save`, { method: 'POST' }),
  unsave: (id: string) => request<{ success: boolean }>(`/opportunities/${id}/save`, { method: 'DELETE' }),
  newCount: () => request<{ count: number }>('/opportunities/new-count'),
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

export const resume = {
  get: () => request<ResumeResponse>('/resume'),
  generate: () => request<ResumeResponse>('/resume/generate', { method: 'POST' }),
  save: (content: Record<string, unknown>) =>
    request<ResumeResponse>('/resume', { method: 'PATCH', body: JSON.stringify({ content }) }),
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  type: string
  link?: string
  is_read: boolean
  created_at: string
}

export const notifications = {
  list: () => request<{ notifications: NotificationItem[]; unread_count: number }>('/notifications'),
  markRead: (id: string) => request<{ status: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request<{ status: string; message: string }>('/notifications/read-all', { method: 'POST' }),
  unreadCount: () => request<{ unread_count: number }>('/notifications/unread/count'),
}

export const health = {
  check: () => request<{ status: string }>('/health'),
}
