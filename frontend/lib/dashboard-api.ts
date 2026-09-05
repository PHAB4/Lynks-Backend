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
