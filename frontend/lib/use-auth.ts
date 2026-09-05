import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function useAuthGate() {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

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
