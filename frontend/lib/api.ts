<<<<<<< HEAD
﻿const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
const BASE = BACKEND
function headers(auth?: string): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  if (auth) h['Authorization'] = `Bearer ${auth}`
  return h
}
async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? body.error ?? `Request failed (${res.status})`)
  }
  return res.json()
}
export const profile = {
  get: (auth: string) => request<any>('/profile', { headers: headers(auth) }),
  update: (auth: string, data: Record<string, any>) =>
    request<any>('/profile', { method: 'PATCH', headers: headers(auth), body: JSON.stringify(data) }),
  setCareerPath: (auth: string, career_path: string) =>
    request<any>('/profile/career-path', { method: 'PATCH', headers: headers(auth), body: JSON.stringify({ career_path }) }),
}
export const roadmap = {
  get: (auth: string) => request<any>('/roadmap', { headers: headers(auth) }),
  generate: (auth: string) => request<any>('/roadmap/generate', { method: 'POST', headers: headers(auth) }),
  regenerate: (auth: string) => request<any>('/roadmap/regenerate', { method: 'POST', headers: headers(auth) }),
}
export const tasks = {
  uploadEvidence: (auth: string, taskId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<any>(`/tasks/${taskId}/evidence`, { method: 'POST', headers: { Authorization: `Bearer ${auth}` }, body: form })
  },
}
export const opportunities = {
  list: (auth: string) => request<any>('/opportunities', { headers: headers(auth) }),
  saved: (auth: string) => request<any>('/opportunities/saved', { headers: headers(auth) }),
  refresh: (auth: string) => request<any>('/opportunities/refresh', { method: 'POST', headers: headers(auth) }),
  newCount: (auth: string) => request<any>('/opportunities/new-count', { headers: headers(auth) }),
  save: (auth: string, id: string) => request<any>(`/opportunities/${id}/save`, { method: 'POST', headers: headers(auth) }),
  unsave: (auth: string, id: string) => request<any>(`/opportunities/${id}/save`, { method: 'DELETE', headers: headers(auth) }),
}
export const resume = {
  get: (auth: string) => request<any>('/resume', { headers: headers(auth) }),
  generate: (auth: string) => request<any>('/resume/generate', { method: 'POST', headers: headers(auth) }),
}
export const chat = {
  send: (auth: string, conversation_id: string | null, message: string) =>
    request<any>('/chat/message', { method: 'POST', headers: headers(auth), body: JSON.stringify({ conversation_id, message }) }),
  history: (auth: string) => request<any>('/chat/history', { headers: headers(auth) }),
  deleteHistory: (auth: string) => request<any>('/chat/history', { method: 'DELETE', headers: headers(auth) }),
  conversations: (auth: string) => request<any>('/chat/conversations', { headers: headers(auth) }),
  getConversation: (auth: string, id: string) => request<any>(`/chat/conversations/${id}`, { headers: headers(auth) }),
}
export const memory = {
  list: (auth: string) => request<any>('/memory', { headers: headers(auth) }),
  add: (auth: string, content: string) => request<any>('/memory', { method: 'POST', headers: headers(auth), body: JSON.stringify({ content }) }),
  update: (auth: string, id: string, content: string) => request<any>(`/memory/${id}`, { method: 'PATCH', headers: headers(auth), body: JSON.stringify({ content }) }),
  delete: (auth: string, id: string) => request<any>(`/memory/${id}`, { method: 'DELETE', headers: headers(auth) }),
}
=======
import { supabase } from '@/lib/supabase'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://lynks-backend-production.up.railway.app'

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function refreshTokenIfNeeded(): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session?.access_token) return null
  return data.session.access_token
}

export async function fetchAPI<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const url = `${BACKEND_URL}${path}`

  const doFetch = async (token?: string) => {
    const headers: Record<string, string> = {
      ...authHeaders,
      ...options.headers,
    }
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  }

  let res = await doFetch()

  if (res.status === 401) {
    const newToken = await refreshTokenIfNeeded()
    if (newToken) {
      res = await doFetch(newToken)
    }
  }

  if (!res.ok) {
    let errorDetail = ''
    try {
      const errBody = await res.json()
      errorDetail =
        errBody?.detail?.error?.message ||
        errBody?.detail?.message ||
        (typeof errBody?.detail === 'string' ? errBody.detail : '') ||
        res.statusText
    } catch {
      errorDetail = res.statusText
    }
    throw new Error(errorDetail || `Request failed (${res.status})`)
  }

  return res.json()
}
>>>>>>> feature/chat-agent-integration
