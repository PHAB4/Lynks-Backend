import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock @supabase/supabase-js BEFORE any module imports it
vi.mock('@supabase/supabase-js', () => {
  const mockGetSession = vi.fn().mockResolvedValue({
    data: { session: null },
  })
  const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null })
  const mockSignUp = vi.fn().mockResolvedValue({ error: null })
  const mockSignOut = vi.fn().mockResolvedValue({ error: null })
  const mockOnAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })

  const mockAuth = {
    getSession: mockGetSession,
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    onAuthStateChange: mockOnAuthStateChange,
  }

  return {
    createClient: vi.fn(() => ({ auth: mockAuth })),
  }
})

// Mock global fetch
vi.stubGlobal('fetch', vi.fn())

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})
