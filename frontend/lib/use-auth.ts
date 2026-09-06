import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function useAuthGate() {
  const router = useRouter()
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>(() => {
    if (typeof window === 'undefined') return 'loading'
    try {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token')
      )
      return key && localStorage.getItem(key) ? 'authenticated' : 'loading'
    } catch {
      return 'loading'
    }
  })
  const initialCheckDone = useRef(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setAuthState('authenticated')
        } else if (initialCheckDone.current) {
          setAuthState('unauthenticated')
          router.push('/login')
        } else {
          initialCheckDone.current = true
          setAuthState('unauthenticated')
          router.push('/login')
        }
      }
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      initialCheckDone.current = true
      if (!session) {
        setAuthState('unauthenticated')
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return authState
}
