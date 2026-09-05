import { fetchAPI } from '@/lib/api'

export interface RoadmapTask {
  task_id: string
  title: string
  description: string
  order: number
  status: 'pending' | 'complete'
}

export interface RoadmapStep {
  step_id: string
  title: string
  description: string
  order: number
  status: 'pending' | 'complete'
  tasks: RoadmapTask[]
}

export interface Roadmap {
  roadmap_id: string
  steps: RoadmapStep[]
}

export async function generateRoadmap(): Promise<Roadmap> {
  return fetchAPI<Roadmap>('/roadmap/generate', { method: 'POST' })
}

export async function getRoadmap(): Promise<Roadmap | null> {
  try {
    return await fetchAPI<Roadmap>('/roadmap')
  } catch {
    return null
  }
}

export async function regenerateRoadmap(): Promise<Roadmap> {
  return fetchAPI<Roadmap>('/roadmap/regenerate', { method: 'POST' })
}
