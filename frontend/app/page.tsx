'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const FEATURES = [
  { tag: 'Login', heading: 'Get connected, get informed and receive guidance.', subheading: 'Make your career journey easier than its ever been', description: '', icon: '💬' },
  { tag: 'Notifications', heading: 'Get notified and even be reminded about incomplete tasks', subheading: '', description: 'As you traverse through your career journey, our systems stay up to date with opportunities to carry you along your career journey and notify you of such. It also notifies you of tasks that you may still have to complete to continue, along your career journey.', icon: '🔔' },
  { tag: 'Resume writing', heading: 'Get usable resumes with the click of a button', subheading: '', description: 'Our systems are not only capable of creating resumes for the user, It also continuously updates the users resume according to the tasks the user completed along their career journey.', icon: '📄' },
  { tag: 'Tasks', heading: 'Lynks guides you every step of the way', subheading: '', description: 'By mapping out each step on the career roadmap Lynks keeps the user on task while making the process personal and more enjoyable. Furthermore, with the assistance of our chat box system the user has the option to ask questions about their career process while being informed fully about application processes and other opportunities.', icon: '📋' },
  { tag: 'Stay informed', heading: 'Keep up to date with opportunities as they appear', subheading: '', description: 'Stay informed about all opportunities in your area not only for the sake of employment but for the personal development. Lynks makes you aware of opportunities opening your mind to other paths not only those in your field of interest.', icon: '✨' },
]

function FeatureIllustration({ icon, index }: { icon: string; index: number }) {
  const colors = [['#6B26EA','#9B6AFF'],['#6B26EA','#8B5CF6'],['#6B26EA','#A855F7'],['#6B26EA','#7C3AED'],['#6B26EA','#8B5CF6']]
  const [c1,c2] = colors[index % colors.length]
  return (
    <div className="relative w-[240px] h-[240px] md:w-[340px] md:h-[340px]">
      <div className="absolute inset-0 rounded-full opacity-30" style={{background:`radial-gradient(circle,${c2} 0%,transparent 70%)`}} />
      <div className="absolute inset-4 md:inset-6 rounded-full" style={{background:`linear-gradient(135deg,${c1} 0%,${c2} 100%)`}}>
        <svg className="absolute inset-0 w-full h-full animate-spin" style={{animationDuration:'20s'}} viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.3" strokeDasharray="4 4" /></svg>
        <div className="absolute top-[15%] right-[20%] w-1.5 h-1.5 rounded-full bg-white/30" />
        <div className="absolute bottom-[25%] left-[15%] w-1 h-1 rounded-full bg-white/20" />
        <div className="absolute top-[10%] left-[20%] text-white/40 text-sm">✦</div>
        <div className="absolute bottom-[15%] right-[25%] text-white/30 text-xs">✦</div>
        <div className="absolute inset-0 flex items-center justify-center"><span className="text-5xl md:text-6xl drop-shadow-lg">{icon}</span></div>
      </div>
    </div>
  )
}

function FeatureSection({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => { const obs = new IntersectionObserver(([e])=>{if(e.isIntersecting)setVisible(true)},{threshold:0.1}); if(ref.current)obs.observe(ref.current); return ()=>obs.disconnect() },[])
  const isEven = index % 2 === 0
  return (
    <div ref={ref} className="flex items-center justify-center py-12 md:py-20 px-4 md:px-12">
      <div className={`flex flex-col ${isEven?'md:flex-row':'md:flex-row-reverse'} items-center gap-8 md:gap-16 max-w-[1100px] w-full transition-all duration-[800ms] ease-out ${visible?'opacity-100 translate-y-0':'opacity-0 translate-y-16'}`}>
        <div className="w-full md:w-1/2 flex justify-center"><div className={`transition-transform duration-[1200ms] ease-out ${visible?'scale-100':'scale-75'}`}><FeatureIllustration icon={feature.icon} index={index} /></div></div>
        <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4">
          <p className="text-[11px] md:text-xs font-bold tracking-[0.25em] text-[#6B26EA] uppercase">{feature.tag}</p>
          <h2 className="text-xl md:text-[30px] font-semibold leading-[1.25] md:leading-[38px] text-[#0D0026]" style={{fontFamily:"'Bricolage Grotesque',sans-serif"}}>{feature.heading}</h2>
          {feature.subheading && <p className="text-base md:text-[20px] leading-[1.4] text-[#8B898E]">{feature.subheading}</p>}
          {feature.description && <p className="text-sm md:text-[15px] leading-[1.75] text-[#8B898E]">{feature.description}</p>}
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(()=>{const h=()=>setScrolled(window.scrollY>20);window.addEventListener('scroll',h);return()=>window.removeEventListener('scroll',h)},[])
  return (
    <div className="flex flex-col min-h-screen bg-[#F7F3FE]">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled?'bg-[#F7F3FE]/95 backdrop-blur-md shadow-sm border-b border-[#EDE3FF]':'bg-transparent'}`}>
        <div className="flex items-center justify-between max-w-[1200px] mx-auto px-5 md:px-6 py-3 md:py-4">
          <span className="text-[#0D0026] text-lg md:text-xl font-bold" style={{fontFamily:"'Bricolage Grotesque',sans-serif"}}>LYNKS</span>
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/login" className="py-2 px-4 md:px-5 rounded-xl border border-[#EDE3FF] bg-white text-xs md:text-[13px] font-semibold text-[#0D0026] hover:bg-[#F9F5FF] hover:border-[#6B26EA]/30 transition-all">Login</Link>
            <Link href="/signup" className="py-2 px-4 md:px-5 rounded-xl bg-[#6B26EA] text-white text-xs md:text-[13px] font-semibold hover:bg-[#5A1FD0] hover:shadow-lg hover:shadow-[#6B26EA]/20 transition-all">Get started</Link>
          </div>
        </div>
      </header>
      <section className="flex flex-col items-center justify-center min-h-[92vh] pt-20 pb-12 px-5">
        <div className="flex flex-col items-center gap-6 md:gap-8 max-w-[800px] text-center animate-[fadeIn_0.8s_ease-out]">
          <span className="text-[#0D0026] text-4xl md:text-5xl font-bold" style={{fontFamily:"'Bricolage Grotesque',sans-serif"}}>LYNKS</span>
          <h1 className="text-2xl md:text-[46px] font-semibold leading-[1.2] md:leading-[1.15] text-[#0D0026]">Get connected, get informed and receive guidance.<br className="hidden md:block" /><span className="text-[#8B898E]"> Make your career journey easier than its ever been</span></h1>
          <div className="flex items-center gap-3 md:gap-4 mt-2 md:mt-4">
            <Link href="/signup" className="py-3 px-6 md:px-8 rounded-xl bg-[#6B26EA] text-white text-sm font-semibold hover:bg-[#5A1FD0] hover:scale-[1.03] active:scale-95 transition-all shadow-lg shadow-[#6B26EA]/25">Sign up</Link>
            <Link href="/signup" className="py-3 px-6 md:px-8 rounded-xl border border-[#EDE3FF] bg-white text-sm font-semibold text-[#0D0026] hover:bg-[#F9F5FF] hover:scale-[1.03] active:scale-95 transition-all">Get started</Link>
          </div>
        </div>
        <div className="mt-12 md:mt-16"><div className="w-5 h-8 md:w-6 md:h-10 rounded-full border-2 border-[#EDE3FF] flex items-start justify-center p-1 animate-bounce"><div className="w-1 h-2 md:w-1.5 md:h-3 rounded-full bg-[#6B26EA] animate-pulse" /></div></div>
      </section>
      <section className="flex flex-col">{FEATURES.slice(1).map((f,i)=>(<FeatureSection key={i} feature={f} index={i} />))}</section>
      <footer className="flex items-center justify-center py-8 md:py-10 border-t border-[#EDE3FF]"><p className="text-sm text-[#8B898E]">2026 LYNKS</p></footer>
      <style jsx global>{`@keyframes fadeIn{from{opacity:0;transform:translateY(25px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}