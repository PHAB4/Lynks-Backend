import { profile, roadmap } from './api'

export interface OnboardingData {
  name: string
  country: string
  employment_status: string
  career_path: string
}

export interface OnboardingStep {
  field: keyof OnboardingData
  question: string
  subtitle: string
  type: 'text' | 'select'
  options?: string[]
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { field: 'name', question: 'What is your name?', subtitle: 'Tell LYNKS what it should call you.', type: 'text' },
  { field: 'country', question: 'What country are you from?', subtitle: 'Help LYNKS tailor opportunities to your region.', type: 'select', options: ['Antigua and Barbuda','Bahamas','Barbados','Belize','Costa Rica','Cuba','Dominica','Dominican Republic','El Salvador','Grenada','Guatemala','Haiti','Honduras','Jamaica','Mexico','Nicaragua','Panama','Puerto Rico','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Suriname','Trinidad and Tobago','United States','Argentina','Bolivia','Chile','Colombia','Ecuador'] },
  { field: 'employment_status', question: 'What is your current employment status?', subtitle: 'This helps LYNKS understand your current situation.', type: 'select', options: ['Student','Employed full-time','Employed part-time','Self-employed','Freelancer','Unemployed (looking)','Unemployed (not looking)','Intern','Apprentice'] },
  { field: 'career_path', question: 'What career are you most interested in?', subtitle: 'Choose the field that excites you most.', type: 'select', options: ['Frontend Engineering','Backend Engineering','Full-Stack Engineering','AI & Machine Learning','Data Analytics','Data Science','UX Design','UI Design','Product Management','Cloud Engineering','Cybersecurity','Mobile Development','DevOps Engineering','Game Development','Blockchain Development','Digital Marketing','Content Creation','Video Production','Project Management','Business Analysis','Entrepreneurship','Financial Technology','Healthcare Technology','Education Technology','Career Strategy'] },
]

export async function submitOnboarding(data: OnboardingData) {
  await profile.update({ name: data.name, country: data.country, employment_status: data.employment_status })
  await profile.setCareerPath(data.career_path)
  await roadmap.generate()
}
