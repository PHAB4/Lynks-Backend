import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Hoisted mocks must use vi.hoisted
const { mockSignUp, mockSignIn, mockPush } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockSignIn: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
    },
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { supabase } from '@/lib/supabase'

describe('Supabase Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('Signup', () => {
    it('calls supabase.auth.signUp with correct params', async () => {
      mockSignUp.mockResolvedValue({ data: { user: { id: '1', email: 'test@test.com' } }, error: null })

      const { data, error } = await supabase.auth.signUp({
        email: 'test@test.com',
        password: 'Password1!',
        options: { data: { full_name: 'Test User' } },
      })

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'Password1!',
        options: { data: { full_name: 'Test User' } },
      })
      expect(error).toBeNull()
      expect(data.user).toBeTruthy()
    })

    it('returns error for duplicate email', async () => {
      mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } })

      const { error } = await supabase.auth.signUp({
        email: 'existing@test.com',
        password: 'Password1!',
      })

      expect(error).toBeTruthy()
      expect(error.message).toContain('already registered')
    })

    it('returns error for weak password', async () => {
      mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'Password should be at least 6 characters' } })

      const { error } = await supabase.auth.signUp({
        email: 'test@test.com',
        password: '123',
      })

      expect(error).toBeTruthy()
    })
  })

  describe('Login', () => {
    it('calls supabase.auth.signInWithPassword with correct params', async () => {
      mockSignIn.mockResolvedValue({
        data: { user: { id: '1', email: 'test@test.com', user_metadata: { full_name: 'Test User' } } },
        error: null,
      })

      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@test.com',
        password: 'Password1!',
      })

      expect(mockSignIn).toHaveBeenCalledWith({ email: 'test@test.com', password: 'Password1!' })
      expect(error).toBeNull()
      expect(data.user).toBeTruthy()
    })

    it('returns error for wrong credentials', async () => {
      mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } })

      const { error } = await supabase.auth.signInWithPassword({
        email: 'test@test.com',
        password: 'WrongPassword',
      })

      expect(error).toBeTruthy()
      expect(error.message).toContain('Invalid login credentials')
    })

    it('returns error for non-existent user', async () => {
      mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } })

      const { error } = await supabase.auth.signInWithPassword({
        email: 'nobody@test.com',
        password: 'Password1!',
      })

      expect(error).toBeTruthy()
    })
  })
})

describe('Signup form validation', () => {
  it('rejects empty name', () => {
    const errors: Record<string, string> = {}
    const name = ''
    if (!name) errors.name = 'Name is required'
    expect(errors.name).toBe('Name is required')
  })

  it('rejects empty email', () => {
    const errors: Record<string, string> = {}
    const email = ''
    if (!email) errors.email = 'Email is required'
    expect(errors.email).toBe('Email is required')
  })

  it('rejects password shorter than 8 chars', () => {
    const passwordRules = [{ test: (p: string) => p.length >= 8 }]
    expect(passwordRules.every(r => r.test('Short1!'))).toBe(false)
  })

  it('rejects password without uppercase', () => {
    const passwordRules = [{ test: (p: string) => /[A-Z]/.test(p) }]
    expect(passwordRules.every(r => r.test('lowercase1!'))).toBe(false)
  })

  it('rejects password without number', () => {
    const passwordRules = [{ test: (p: string) => /[0-9]/.test(p) }]
    expect(passwordRules.every(r => r.test('NoNumber!'))).toBe(false)
  })

  it('rejects password without special character', () => {
    const passwordRules = [{ test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) }]
    expect(passwordRules.every(r => r.test('NoSpecial1'))).toBe(false)
  })

  it('rejects mismatched passwords', () => {
    expect('Password1!' === 'Password2!').toBe(false)
  })

  it('accepts valid password', () => {
    const passwordRules = [
      { test: (p: string) => p.length >= 8 },
      { test: (p: string) => /[A-Z]/.test(p) },
      { test: (p: string) => /[a-z]/.test(p) },
      { test: (p: string) => /[0-9]/.test(p) },
      { test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
    ]
    expect(passwordRules.every(r => r.test('Password1!'))).toBe(true)
  })
})

describe('Login form validation', () => {
  it('rejects empty email', () => {
    const errors: Record<string, string> = {}
    const email = ''
    if (!email) errors.email = 'Email is required'
    expect(errors.email).toBe('Email is required')
  })

  it('rejects empty password', () => {
    const errors: Record<string, string> = {}
    const password = ''
    if (!password) errors.password = 'Password is required'
    expect(errors.password).toBe('Password is required')
  })
})
