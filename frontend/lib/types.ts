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

export interface RoadmapResponse {
  roadmap_id: string
  steps: StepResponse[]
}

export interface StepResponse {
  step_id: string
  title: string
  description: string
  order: number
  status: 'pending' | 'complete'
  tasks: TaskResponse[]
}

export interface TaskResponse {
  task_id: string
  title: string
  description: string
  order: number
  status: 'pending' | 'complete'
}

export interface EvidenceResponse {
  id: string
  task_id: string
  file_url: string
  file_type: string
  verification_status: 'pending' | 'verified' | 'rejected'
  uploaded_at: string
}

export interface PortfolioEntry {
  task_id: string
  title: string
  evidence: EvidenceResponse[]
}

export interface Opportunity {
  id: string
  title: string
  company: string
  location: string
  category: string
  description: string
  url: string | null
  pay: string | null
  age_requirement: string | null
  experience_required: string | null
}

export interface ChatConversation {
  conversation_id: string | null
  messages: ChatMessage[]
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_calls: any | null
  created_at: string
}

export interface ChatSendResponse {
  conversation_id: string
  response: string
  tool_calls: any | null
}
