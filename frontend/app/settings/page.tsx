'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, ArrowLeft } from 'lucide-react'
import AppLayout from '@/components/AppLayout'

export default function SettingsPage() {
  const [interests, setInterests] = useState(['Frontend Engineering', 'AI & Machine Learning', 'Data Analytics', 'Career Strategy'])

  return (
    <AppLayout>
      <div className="flex-1 pt-12 pr-6 md:pr-36 pb-20 pl-6 md:pl-36">
        <div className="flex gap-10">
          {/* Settings sidebar */}
          <div className="flex flex-col items-start w-[280px] shrink-0">
            <p className="text-[rgba(30,30,30,0.40)] text-xs leading-[50px] w-12 h-[39px]" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
              Settings
            </p>
            <div className="flex py-3.5 px-4 items-center gap-3 rounded-xl bg-[rgba(107,38,234,0.08)] w-full h-[43px]">
              <User size={20} className="text-[#6B26EA] shrink-0" />
              <p className="text-[#6B26EA] text-xs leading-[50px] w-full" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
                Profile
              </p>
              <div className="rounded-sm bg-[#6B26EA] w-1 h-4 shrink-0"></div>
            </div>
            <div className="bg-[rgba(30,30,30,0.07)] w-full h-px my-1"></div>
            <Link href="/dashboard" className="flex py-3 px-4 items-center gap-2 w-fit hover:opacity-70 transition-opacity cursor-pointer">
              <ArrowLeft size={16} className="text-[#6B26EA] shrink-0" />
              <p className="text-[#6B26EA] text-sm font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>
                Back to Dashboard
              </p>
            </Link>
          </div>

          {/* Settings form */}
          <div className="flex p-10 flex-col items-start gap-8 rounded-3xl bg-[#FFF] shadow-[0_12px_32px_rgba(107,38,234,0.04)] flex-1">
            <div className="flex flex-col items-start gap-2 w-full">
              <p className="text-[#1E1E1E] text-[28px] font-semibold w-full" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 600 }}>
                Profile Settings
              </p>
              <p className="text-[rgba(30,30,30,0.60)] text-[15px] w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
                Update your personal details, professional biography, and target career interests to fine-tune your roadmap.
              </p>
              <div className="bg-[rgba(30,30,30,0.07)] w-full h-px mt-2"></div>
            </div>

            {/* Profile photo */}
            <div className="flex items-center gap-6 w-full">
              <div className="w-20 h-20 rounded-full bg-[rgba(154,152,152,0.20)] flex items-center justify-center shrink-0">
                <User size={32} className="text-[rgba(154,152,152,0.50)]" />
              </div>
              <div className="flex flex-col items-start gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex py-2.5 px-4 items-start rounded-[10px] bg-[#6B26EA] cursor-pointer hover:bg-[#5A1FD0] transition-colors">
                    <p className="text-[#FFF] text-sm font-semibold" style={{ fontFamily: "'Inter', sans-serif" }}>Upload new photo</p>
                  </div>
                  <div className="flex py-2.5 px-4 items-start rounded-[10px] border border-[rgba(30,30,30,0.12)] cursor-pointer hover:bg-gray-50 transition-colors">
                    <p className="text-[rgba(30,30,30,0.80)] text-sm font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>Remove</p>
                  </div>
                </div>
                <p className="text-[rgba(30,30,30,0.40)] text-xs" style={{ fontFamily: "'Inter', sans-serif" }}>
                  JPG, GIF or PNG. Max size of 800K.
                </p>
              </div>
            </div>

            {/* Form fields */}
            <div className="flex flex-col items-start gap-5 w-full">
              <div className="flex items-start gap-5 w-full">
                <div className="flex flex-col items-start gap-2 w-full">
                  <p className="text-[rgba(30,30,30,0.80)] text-sm font-semibold w-full" style={{ fontFamily: "'Inter', sans-serif" }}>Full Name</p>
                  <input type="text" defaultValue="Alex Morgan" className="flex p-3.5 items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] w-full text-[15px] focus:outline-none focus:border-[#6B26EA] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }} />
                </div>
                <div className="flex flex-col items-start gap-2 w-full">
                  <p className="text-[rgba(30,30,30,0.80)] text-sm font-semibold w-full" style={{ fontFamily: "'Inter', sans-serif" }}>Email Address</p>
                  <input type="email" defaultValue="alex.morgan@lynk.io" className="flex p-3.5 items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] w-full text-[15px] focus:outline-none focus:border-[#6B26EA] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }} />
                </div>
              </div>
              <div className="flex items-start gap-5 w-full">
                <div className="flex flex-col items-start gap-2 w-full">
                  <p className="text-[rgba(30,30,30,0.80)] text-sm font-semibold w-full" style={{ fontFamily: "'Inter', sans-serif" }}>Phone Number</p>
                  <input type="tel" defaultValue="+1 (555) 019-2834" className="flex p-3.5 items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] w-full text-[15px] focus:outline-none focus:border-[#6B26EA] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }} />
                </div>
                <div className="flex flex-col items-start gap-2 w-full">
                  <p className="text-[rgba(30,30,30,0.80)] text-sm font-semibold w-full" style={{ fontFamily: "'Inter', sans-serif" }}>Current Role</p>
                  <input type="text" defaultValue="Associate Product Designer" className="flex p-3.5 items-center gap-2.5 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] w-full text-[15px] focus:outline-none focus:border-[#6B26EA] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }} />
                </div>
              </div>
            </div>

            {/* Career interests */}
            <div className="flex flex-col items-start gap-4 w-full">
              <div className="flex flex-col items-start gap-1 w-full">
                <p className="text-[rgba(30,30,30,0.80)] text-sm font-semibold w-full" style={{ fontFamily: "'Inter', sans-serif" }}>Career of interest</p>
                <p className="text-[rgba(30,30,30,0.40)] text-[13px] w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
                  These tags help Lynk suggest tailored mentorships, tasks, and opportunities in your backyard.
                </p>
              </div>
              <div className="flex items-start gap-2.5 flex-wrap w-full">
                {interests.map((interest, i) => (
                  <div key={i} className="flex py-2 px-4 items-center gap-2 rounded-[20px] bg-[#EDE3FF] w-fit cursor-pointer hover:bg-[#D4C4F7] transition-colors">
                    <p className="text-[#6B26EA] text-[13px] font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>{interest}</p>
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.91602 7H11.0836M6.99982 2.9162V11.0838" stroke="#6B26EA" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[rgba(30,30,30,0.07)] w-full h-px"></div>

            {/* Actions */}
            <div className="flex justify-end items-start gap-3 w-full">
              <Link href="/dashboard" className="flex py-3 px-6 items-start rounded-[50px] border border-[rgba(30,30,30,0.20)] hover:bg-gray-50 transition-colors cursor-pointer">
                <p className="text-[rgba(30,30,30,0.80)] text-sm font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>Cancel</p>
              </Link>
              <button className="cursor-pointer text-nowrap flex py-2.5 px-6 justify-center items-center gap-2.5 rounded-[20px] border border-[rgba(0,0,0,0.43)] bg-[#EADFFF] hover:bg-[#D4C4F7] transition-colors">
                <p className="text-[#000] text-sm" style={{ fontFamily: "'Helvetica Now Display', 'Inter', sans-serif" }}>Continue</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
