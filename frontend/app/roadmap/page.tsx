'use client'

import { Map } from 'lucide-react'
import AppLayout from '@/components/AppLayout'

export default function RoadmapPage() {
  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-[#F9F5FF]">
        <div className="flex-1 p-10">
          <div className="flex items-center gap-3 mb-8">
            <Map className="text-[#6B26EA]" size={24} />
            <h1 className="text-2xl md:text-[40px] font-semibold leading-tight md:leading-[50px] text-[#0D0026]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Career Roadmap</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#EADFFF] flex items-center justify-center mb-4">
              <Map size={24} className="text-[#6B26EA]" />
            </div>
            <p className="text-lg font-semibold text-[#0D0026] mb-2">No roadmap yet</p>
            <p className="text-sm text-[#8B898E] max-w-md">Complete your onboarding and our AI will generate a personalized career roadmap tailored to your goals and interests.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
