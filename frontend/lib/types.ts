export interface User {
  user_id: string
  name: string
  email: string
  age: number | null
  country: string | null
  education_level: string | null
  employment_status: string | null
  interests: string[]
  career_path: string | null
  created_at: string
}

export interface RoadmapStep {
  step_id: string
  title: string
  description: string
  status: string
  order: number
  tasks: RoadmapTask[]
}

export interface RoadmapTask {
  task_id: string
  title: string
  description: string
  status: string
  order: number
}

export interface RoadmapResponse {
  roadmap_id: string
  career_path: string
  steps: RoadmapStep[]
  created_at: string
}

export interface EvidenceResponse {
  evidence_id: string
  task_id: string
  file_url: string
  status: string
}

export interface PortfolioEntry {
  id: string
  title: string
  description: string
  url: string | null
  created_at: string
}

export interface Opportunity {
  id: string
  title: string
  company: string
  description: string
  category: string
  location: string
  pay: string | null
  url: string | null
  age_requirement: string | null
  source_name?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string | null
  relevance_score?: number | null
  is_saved?: boolean
  experience_required?: string | null
  image_url?: string | null
  posted_at?: string | null
  first_seen_at?: string | null
}

export interface ChatSendResponse {
  message_id: string
  content: string
  conversation_id: string
}

export interface ResumeData {
  name: string
  email: string
  phone: string
  address: string
  objective: string
  education: { institution: string; level: string; details: string }[]
  skills: string[]
  experience: { title: string; organization: string; dates?: string; description: string }[]
  projects: { title: string; description: string; skills_used: string[] }[]
  certifications: string[]
  interests: string[]
  custom_sections?: { title: string; content: string }[]
}

export interface ResumeResponse {
  resume_id: string
  content: ResumeData
  created_at: string
  updated_at?: string
}

export interface ChatConversation {
  conversation_id: string
  messages: ChatMessage[]
}

export interface ChatMessage {
  role: string
  content: string
  timestamp: string
}
