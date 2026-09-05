'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''
const BASE = BACKEND

export interface User {
  user_id: string
  username: string
  name: string | null
  email: string
  age: number | null
  country: string | null
  education_level: string | null
  employment_status: string | null
  career_path: string | null
  interests: string[]
  created_at: string
}

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<User | null>
  signUp: (email: string, password: string) => Promise<User | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

async function fetchProfile(token: string): Promise<User | null> {
  try {
    const res = await fetch(`${BASE}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function userFromSession(session: { user: { id: string; email?: string; user_metadata?: Record<string, any> } }): User {
  const meta = session.user.user_metadata ?? {}
  return {
    user_id: session.user.id,
    username: meta.username ?? session.user.email?.split('@')[0] ?? 'user',
    name: meta.name ?? null,
    email: session.user.email ?? '',
    age: null,
    country: null,
    education_level: null,
    employment_status: null,
    career_path: null,
    interests: [],
    created_at: new Date().toISOString(),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const userRef = useRef<User | null>(null)
  const latestUser = () => userRef.current

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.access_token) {
        const profile = await fetchProfile(session.access_token) ?? userFromSession(session)
        setUser(profile)
        userRef.current = profile
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        const profile = await fetchProfile(session.access_token) ?? userFromSession(session)
        setUser(profile)
        userRef.current = profile
      } else {
        setUser(null)
        userRef.current = null
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const waitForUser = () => new Promise<void>((resolve) => {
    const check = () => {
      if (latestUser()) resolve()
      else setTimeout(check, 50)
    }
    check()
  })

  const signIn = useCallback(async (email: string, password: string): Promise<User | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await waitForUser()
    return latestUser()
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<User | null> => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    await waitForUser()
    return latestUser()
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    userRef.current = null
    router.push('/')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
