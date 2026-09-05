import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function getCachedSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(localStorage.getItem('sb-qcyxyunngbkupttcwlbk-auth-token'))
  } catch {
    return false
  }
}

export function useAuthGate() {
  const router = useRouter()
  const [checked, setChecked] = useState(() => getCachedSession())

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) {
        router.push('/login')
      } else {
        setChecked(true)
      }
    }
    check()
    return () => { cancelled = true }
  }, [router])

  return checked
}
