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
      errorDetail = errBody?.detail?.message || errBody?.detail || res.statusText
    } catch {
      errorDetail = res.statusText
    }
    throw new Error(errorDetail || `Request failed (${res.status})`)
  }

  return res.json()
}
