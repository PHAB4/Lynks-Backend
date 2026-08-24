'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const FEATURES = [
  { tag: 'Login', heading: 'Get connected, get informed and receive guidance.', subheading: 'Make your career journey easier than its ever been', description: '', image: '/images/LNFMMqlJPosVeR1MkDOtzG9OmX4.png' },
  { tag: 'Notifications', heading: 'Get notified and even be reminded about incomplete tasks', subheading: '', description: 'As you traverse through your career journey, our systems stay up to date with opportunities to carry you along your career journey and notify you of such. It also notifies you of tasks that you may still have to complete to continue, along your career journey.', image: '/images/OxA7NlDbOxTaTU6TLtJ6Bf0vvI.png' },
  { tag: 'Resume writing', heading: 'Get usable resumes with the click of a button', subheading: '', description: 'Our systems are not only capable of creating resumes for the user, It also continuously updates the users resume according to the tasks the user completed along their career journey.', image: '/images/lY89a5i4dJFJRvKsqqmRte78SI.png' },
  { tag: 'Tasks', heading: 'Lynks guides you every step of the way', subheading: '', description: 'By mapping out each step on the career roadmap Lynks keeps the user on task while making the process personal and more enjoyable. Furthermore, with the assistance of our chat box system the user has the option to ask questions about their career process while being informed fully about application processes and other opportunities.', image: '/images/VATig1fwVrqP6Ni30VbZR37tals.png' },
  { tag: 'Stay informed', heading: 'Keep up to date with opportunities as they appear', subheading: '', description: 'Stay informed about all opportunities in your area not only for the sake of employment but for the personal development. Lynks makes you aware of opportunities opening your mind to other paths not only those in your field of interest.', image: '/images/LNFMMqlJPosVeR1MkDOtzG9OmX4.png' },
]

function FeatureSection({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true) }, { threshold: 0.15 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const isEven = index % 2 === 0
  return (
    <div ref={ref} className="flex items-center justify-center py-12 md:py-20 px-4 md:px-12">
      <div className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 md:gap-16 max-w-[1100px] w-full transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="w-full md:w-1/2 flex justify-center">
          <div className="relative w-[280px] h-[280px] md:w-[400px] md:h-[400px]"><Image src={feature.image} alt={feature.tag} fill className="object-contain" sizes="(max-width: 768px) 280px, 400px" /></div>
        </div>
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          <p className="text-xs font-bold tracking-[0.2em] text-[#6B26EA] uppercase">{feature.tag}</p>
          <h2 className="text-2xl md:text-[32px] font-semibold leading-[1.2] md:leading-[40px] text-[#0D0026]">{feature.heading}</h2>
          {feature.subheading && <p className="text-lg md:text-[22px] leading-[1.4] text-[#8B898E]">{feature.subheading}</p>}
          {feature.description && <p className="text-sm md:text-[15px] leading-[1.7] text-[#8B898E]">{feature.description}</p>}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const handler = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', handler); return () => window.removeEventListener('scroll', handler) }, [])
  return (
    <div className="flex flex-col min-h-screen bg-[#F7F3FE]">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#F7F3FE]/90 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="flex items-center justify-between max-w-[1200px] mx-auto px-6 py-4">
          <span className="text-[#0D0026] text-xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>LYNKS</span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="py-2 px-5 rounded-xl border border-[#EDE3FF] bg-white text-[13px] font-semibold text-[#0D0026] hover:bg-[#F9F5FF] transition-colors">Login</Link>
            <Link href="/signup" className="py-2 px-5 rounded-xl bg-[#6B26EA] text-white text-[13px] font-semibold hover:bg-[#5A1FD0] transition-colors">Get started</Link>
          </div>
        </div>
      </header>
      <section className="flex flex-col items-center justify-center min-h-[90vh] pt-20 pb-16 px-6 animate-[fadeIn_0.8s_ease-out]">
        <div className="flex flex-col items-center gap-8 max-w-[800px] text-center">
          <span className="text-[#0D0026] text-4xl md:text-5xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>LYNKS</span>
          <h1 className="text-3xl md:text-[48px] font-semibold leading-[1.15] md:leading-[56px] text-[#0D0026]">Get connected, get informed and receive guidance.<br /><span className="text-[#8B898E]">Make your career journey easier than its ever been</span></h1>
          <div className="flex items-center gap-4 mt-4">
            <Link href="/signup" className="py-3 px-8 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#6B26EA]/20">Sign up</Link>
            <Link href="/signup" className="py-3 px-8 rounded-xl border border-[#EDE3FF] bg-white text-sm font-semibold text-[#0D0026] hover:bg-[#F9F5FF] hover:scale-105 active:scale-95 transition-all">Get started</Link>
          </div>
        </div>
        <div className="mt-16 animate-bounce"><div className="w-6 h-10 rounded-full border-2 border-[#EDE3FF] flex items-start justify-center p-1"><div className="w-1.5 h-3 rounded-full bg-[#6B26EA] animate-pulse" /></div></div>
      </section>
      <section className="flex flex-col gap-4">{FEATURES.slice(1).map((feature, i) => (<FeatureSection key={i} feature={feature} index={i} />))}</section>
      <footer className="flex items-center justify-center py-10 border-t border-[#EDE3FF]"><p className="text-sm text-[#8B898E]">2026 LYNKS</p></footer>
      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}