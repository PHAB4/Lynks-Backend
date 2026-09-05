import { fetchAPI } from '@/lib/api'

export interface DashboardProfile {
  id: string
  email: string
  name: string | null
  age: number | null
  country: string | null
  education_level: string | null
  career_path: string | null
  employment_status: string | null
  interests: string[] | null
  created_at: string
}

export interface DashboardOpportunity {
  id: string
  title: string
  company: string
  location: string
  description: string
  category: string
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  url: string
  image_url: string | null
  is_saved: boolean
}

export async function getProfile(): Promise<DashboardProfile> {
  return fetchAPI<DashboardProfile>('/profile')
}

export async function updateCareerPath(careerPath: string) {
  return fetchAPI<{ career_path: string }>('/profile/career-path', {
    method: 'PATCH',
    body: JSON.stringify({ career_path: careerPath }),
  })
}

export async function getOpportunities(params?: { category?: string; limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  const qs = searchParams.toString()
  return fetchAPI<DashboardOpportunity[]>(`/opportunities${qs ? `?${qs}` : ''}`)
}

export async function getUnreadNotificationCount() {
  return fetchAPI<{ count: number }>('/notifications/unread/count')
}

export async function getPortfolio() {
  return fetchAPI<{ entries: any[] }>('/portfolio')
}

export interface DashboardSummary {
  profile: {
    name: string | null
    email: string
    role: string
    interests: string[]
    career_path: string | null
    has_completed_onboarding: boolean
  } | null
  roadmap: {
    has_roadmap: boolean
    career_path: string | null
    total_tasks: number
    completed_tasks: number
    progress_percent: number
    current_step: string | null
    current_step_index: number
    total_steps: number
  }
  opportunities: {
    new_count: number
    recent: Array<{
      id: string
      title: string
      company: string
      location: string
      salary_min: number | null
      salary_max: number | null
      currency: string | null
      category: string
      posted_at: string | null
    }>
  }
  notifications: {
    unread_count: number
    recent: Array<{
      id: string
      title: string
      body: string
      type: string
      is_read: boolean
      created_at: string | null
    }>
  }
  onboarding_checklist: {
    complete_profile: boolean
    start_chat: boolean
    generate_roadmap: boolean
    browse_opportunities: boolean
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchAPI<DashboardSummary>('/dashboard/summary')
}
