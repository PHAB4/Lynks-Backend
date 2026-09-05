import { supabase } from '@/lib/supabase'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://lynks-backend-production.up.railway.app'

export async function fetchAPI(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body?.detail
    let msg: string
    if (typeof detail === 'string') {
      msg = detail
    } else if (detail?.error?.message) {
      msg = `${detail.error.code}: ${detail.error.message}`
    } else if (detail?.message) {
      msg = detail.message
    } else {
      msg = `Request failed (${res.status})`
    }
    if (res.status === 401) throw new Error('Not authenticated')
    throw new Error(msg)
  }

  return res.json()
}
