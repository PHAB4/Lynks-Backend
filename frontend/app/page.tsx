'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'

function AnimatedSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('animate-in'), delay)
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])
  return (
    <div ref={ref} className={`scroll-animate ${className}`}>
      {children}
    </div>
  )
}

export default function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [showLogin, setShowLogin] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const features = [
    {
      label: 'NOTIFICATIONS',
      title: 'Get notified and even be reminded about incomplete tasks',
      description: 'As you traverse through your career journey, our systems stay up to date with opportunities to carry you along your career journey and notify you of such. It also notifies you of tasks that you may still have to complete to continue, along your career journey.',
      image: '/images/OxA7NlDbOxTaTU6TLtJ6Bf0vvI.png',
      imageAlt: 'Notifications',
      reverse: false,
    },
    {
      label: 'RESUME WRITING',
      title: 'Get usable resumes with the click of a button',
      description: 'Our systems are not only capable of creating resumes for the user, It also continuously updates the users resume according to the tasks the user completed along their career journey',
      image: '/images/lY89a5i4dJFJRvKsqqmRte78SI.png',
      imageAlt: 'Resume',
      reverse: true,
    },
    {
      label: 'TASKS',
      title: 'Lynks guides you every step of the way',
      description: 'By mapping out each step on the career roadmap Lynks keeps the user on task while making the process personal and more enjoyable. Furthermore, with the assistance of our on chat box system the user has the option to ask questions about their career process while being informed fully about application processes and other opportunities',
      image: '/images/LNFMMqlJPosVeR1MkDOtzG9OmX4.png',
      imageAlt: 'Tasks',
      reverse: false,
    },
    {
      label: 'STAY INFORMED',
      title: 'Keep up to date with opportunities as they appear',
      description: 'Stay informed about all opportunities in your area not only for the sake of employment but for the personal development. Lynks makes you aware of opportunities opening your mind to other paths not only those in your field of interest',
      image: '/images/VATig1fwVrqP6Ni30VbZR37tals.png',
      imageAlt: 'Stay Informed',
      reverse: true,
    },
  ]

  return (
    <>
      <style>{`
        .scroll-animate {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scroll-animate.animate-in {
          opacity: 1;
          transform: translateY(0);
        }
        .mouse-glow {
          position: fixed;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(107,38,234,0.08) 0%, rgba(107,38,234,0.03) 40%, transparent 70%);
          pointer-events: none;
          z-index: 0;
          transform: translate(-50%, -50%);
          transition: left 0.3s ease-out, top 0.3s ease-out;
        }
        .halftone-pattern {
          background-image: radial-gradient(circle, #6B26EA 1px, transparent 1px);
          background-size: 8px 8px;
          opacity: 0.25;
        }
        .nav-shadow {
          box-shadow: 0 1px 0 rgba(0,0,0,0.06);
        }
        .feature-image-circle {
          position: relative;
        }
        .feature-image-circle::before {
          content: '';
          position: absolute;
          inset: -20px;
          border-radius: 50%;
          border: 1px dashed rgba(107,38,234,0.2);
          animation: spin-slow 30s linear infinite;
        }
        .feature-image-circle::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6B26EA;
          top: 0;
          right: 30%;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .star-decoration {
          position: absolute;
          color: rgba(107,38,234,0.3);
        }
      `}</style>

      <div className="mouse-glow" style={{ left: mousePos.x, top: mousePos.y }} />

      <div className="flex flex-col items-center bg-[#F9F5FF] min-h-screen w-full overflow-hidden relative z-10">
        {/* Navbar */}
        <nav className="nav-shadow flex items-center justify-between w-full max-w-[1200px] mx-auto px-5 py-4">
          <svg viewBox="0 0 64 20" className="h-5 w-auto" fill="black"><path d="M33.7891 3.49091H35.5461C37.0206 3.49091 37.805 4.36364 37.805 6.00436V7.85455C37.805 8.02909 37.7265 8.13382 37.554 8.13382H35.9225C35.7657 8.13382 35.6716 8.02909 35.6716 7.85455V6.49309C35.6716 6.03927 35.4676 5.79491 35.0441 5.79491H34.2911C33.8989 5.79491 33.6636 6.03927 33.6636 6.49309V8.90182L37.3971 10.2633C37.6638 10.3855 37.805 10.5775 37.805 10.9091V14.9411C37.805 16.5818 37.0206 17.4545 35.5461 17.4545H33.7891C32.3302 17.4545 31.5302 16.5818 31.5302 14.9411V13.1084C31.5302 12.9164 31.6243 12.8291 31.7812 12.8291H33.4126C33.5852 12.8291 33.6636 12.9164 33.6636 13.1084V14.4524C33.6636 14.9236 33.8989 15.1505 34.2911 15.1505H35.0441C35.4519 15.1505 35.6716 14.9236 35.6716 14.4524V12.1309L31.9537 10.7695C31.6714 10.6647 31.5302 10.4553 31.5302 10.1236V6.00436C31.5302 4.36364 32.3302 3.49091 33.7891 3.49091Z" /><path d="M29.8339 17.4545H28.1711C27.9829 17.4545 27.873 17.3673 27.8103 17.1927L25.8337 12.0087L25.2533 13.248V17.1055C25.2533 17.3324 25.1435 17.4545 24.9396 17.4545H23.4336C23.2297 17.4545 23.1199 17.3324 23.1199 17.1055V3.84C23.1199 3.61309 23.2297 3.49091 23.4336 3.49091H24.9396C25.1435 3.49091 25.2533 3.61309 25.2533 3.84V9.25091L27.6691 3.75273C27.7476 3.57818 27.8574 3.49091 28.0299 3.49091H29.677C29.9124 3.49091 30.0065 3.66545 29.8967 3.90982L27.2299 10.0015L30.0692 17.0531C30.179 17.28 30.0849 17.4545 29.8339 17.4545Z" /><path d="M19.6634 3.49091H21.2948C21.4517 3.49091 21.5458 3.59564 21.5458 3.77018V17.1753C21.5458 17.3498 21.4517 17.4545 21.2948 17.4545H19.7418C19.6006 17.4545 19.5065 17.3847 19.4594 17.2276L17.0593 9.77454H16.9809V17.1753C16.9809 17.3498 16.9025 17.4545 16.7299 17.4545H15.0985C14.9416 17.4545 14.8475 17.3498 14.8475 17.1753V3.77018C14.8475 3.59564 14.9416 3.49091 15.0985 3.49091H16.6515C16.7927 3.49091 16.8868 3.56073 16.9338 3.71782L19.3183 11.136H19.4124V3.77018C19.4124 3.59564 19.4908 3.49091 19.6634 3.49091Z" /><path d="M11.8999 3.49091H13.4686C13.7039 3.49091 13.8137 3.648 13.7196 3.89236L10.8489 11.6596V17.1055C10.8489 17.3324 10.7391 17.4545 10.5351 17.4545H9.0292C8.82527 17.4545 8.71546 17.3324 8.71546 17.1055V11.6596L5.84474 3.89236C5.75062 3.648 5.86043 3.49091 6.09574 3.49091H7.66443C7.85268 3.49091 7.96249 3.57818 8.02523 3.77018L9.78217 8.77964L11.5391 3.77018C11.6019 3.57818 11.7117 3.49091 11.8999 3.49091Z" /><path d="M2.13343 14.9324H5.86693C6.03948 14.9324 6.11792 15.0371 6.11792 15.2116V16.9571C6.11792 17.1491 6.03948 17.2364 5.86693 17.2364H0.250991C0.09412 17.2364 0 17.1491 0 16.9571V3.552C0 3.37745 0.09412 3.27273 0.250991 3.27273H1.88244C2.05499 3.27273 2.13343 3.37745 2.13343 3.552V14.9324Z" /></svg>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowLogin(true)} className="text-[#8B898E] text-sm hover:text-[#0D0026] transition-colors cursor-pointer" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
              Login
            </button>
            <Link href="/signup" className="bg-[#6B26EA] text-white text-sm px-6 py-2 rounded-full hover:bg-[#5A1FD0] transition-colors" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
              Sign up
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-[1200px] mx-auto px-5 py-12 relative">
          <div className="relative">
            <p className="text-[128px] leading-[55px] text-[#6B26EA] mb-2" style={{ fontFamily: "'Birthstone', cursive" }}>{"Let's".split("").map((char, i) => (<span key={i} className="hero-letter" style={{ animationDelay: `${i * 0.08}s` }}>{char === " " ? "00A0" : char}</span>))}</p>
            <h1 className="text-[96px] leading-[55px] font-semibold text-[#0D0026] mb-16" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 600 }}>{"Lynk".split("").map((char, i) => (<span key={i} className="hero-letter" style={{ animationDelay: `${0.4 + i * 0.08}s` }}>{char}</span>))}</h1>
            <div className="halftone-pattern absolute -right-20 top-0 w-[180px] h-[140px] rounded-full" />
          </div>
          <Link href="/onboarding" className="bg-[#6B26EA] text-white text-sm px-8 py-3 rounded-full hover:bg-[#5A1FD0] transition-colors" style={{ fontFamily: "'Helvetica Now Display', 'Inter', sans-serif" }}>
            Get started
          </Link>
        </div>

        {/* Tagline bar */}
        <div className="w-full bg-[#6B26EA] py-10 px-12">
          <h2 className="text-white text-[29px] font-medium leading-[130%] text-center max-w-[800px] mx-auto" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 500 }}>
            Get connected, get informed and receive guidance. Make your career journey easier than its ever been
          </h2>
        </div>

        {/* Feature sections */}
        {features.map((feature, i) => (
          <AnimatedSection key={i} delay={i * 100}>
            <div className={`w-full max-w-[1200px] mx-auto px-[60px] py-16 my-6 flex items-center gap-14 ${feature.reverse ? 'flex-row-reverse' : ''}`}>
              {/* Text side */}
              <div className={`flex-1 flex flex-col gap-6 ${feature.reverse ? 'items-end text-right' : 'items-start text-left'}`}>
                <span className="text-[#6B26EA] text-xs font-semibold tracking-[0.15em] uppercase" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
                  {feature.label}
                </span>
                <h3 className="text-[25px] font-bold leading-[40px] text-[#0D0026]" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}>
                  {feature.title}
                </h3>
                <p className="text-[16px] leading-[28px] text-[rgba(0,0,0,0.6)]" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>
                  {feature.description}
                </p>
              </div>
              {/* Image side */}
              <div className="flex-1 flex justify-center">
                <div className="feature-image-circle relative w-[380px] h-[380px]">
                  <img src={feature.image} alt={feature.imageAlt} className="w-full h-full object-cover rounded-full" />
                  <svg className="star-decoration" style={{ top: '-10px', right: '10%', width: 16, height: 16 }} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2L8 0Z" />
                  </svg>
                  <svg className="star-decoration" style={{ bottom: '20%', left: '-5px', width: 10, height: 10 }} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0L9.8 6.2L16 8L9.8 9.8L8 16L6.2 9.8L0 8L6.2 6.2L8 0Z" />
                  </svg>
                </div>
              </div>
            </div>
          </AnimatedSection>
        ))}

        {/* Footer */}
        <footer className="w-full bg-[#E0E0E0] py-5 px-5 mt-12">
          <div className="flex items-center justify-between max-w-[1200px] mx-auto">
            <svg viewBox="0 0 64 20" className="h-5 w-auto" fill="black"><path d="M33.7891 3.49091H35.5461C37.0206 3.49091 37.805 4.36364 37.805 6.00436V7.85455C37.805 8.02909 37.7265 8.13382 37.554 8.13382H35.9225C35.7657 8.13382 35.6716 8.02909 35.6716 7.85455V6.49309C35.6716 6.03927 35.4676 5.79491 35.0441 5.79491H34.2911C33.8989 5.79491 33.6636 6.03927 33.6636 6.49309V8.90182L37.3971 10.2633C37.6638 10.3855 37.805 10.5775 37.805 10.9091V14.9411C37.805 16.5818 37.0206 17.4545 35.5461 17.4545H33.7891C32.3302 17.4545 31.5302 16.5818 31.5302 14.9411V13.1084C31.5302 12.9164 31.6243 12.8291 31.7812 12.8291H33.4126C33.5852 12.8291 33.6636 12.9164 33.6636 13.1084V14.4524C33.6636 14.9236 33.8989 15.1505 34.2911 15.1505H35.0441C35.4519 15.1505 35.6716 14.9236 35.6716 14.4524V12.1309L31.9537 10.7695C31.6714 10.6647 31.5302 10.4553 31.5302 10.1236V6.00436C31.5302 4.36364 32.3302 3.49091 33.7891 3.49091Z" /><path d="M29.8339 17.4545H28.1711C27.9829 17.4545 27.873 17.3673 27.8103 17.1927L25.8337 12.0087L25.2533 13.248V17.1055C25.2533 17.3324 25.1435 17.4545 24.9396 17.4545H23.4336C23.2297 17.4545 23.1199 17.3324 23.1199 17.1055V3.84C23.1199 3.61309 23.2297 3.49091 23.4336 3.49091H24.9396C25.1435 3.49091 25.2533 3.61309 25.2533 3.84V9.25091L27.6691 3.75273C27.7476 3.57818 27.8574 3.49091 28.0299 3.49091H29.677C29.9124 3.49091 30.0065 3.66545 29.8967 3.90982L27.2299 10.0015L30.0692 17.0531C30.179 17.28 30.0849 17.4545 29.8339 17.4545Z" /><path d="M19.6634 3.49091H21.2948C21.4517 3.49091 21.5458 3.59564 21.5458 3.77018V17.1753C21.5458 17.3498 21.4517 17.4545 21.2948 17.4545H19.7418C19.6006 17.4545 19.5065 17.3847 19.4594 17.2276L17.0593 9.77454H16.9809V17.1753C16.9809 17.3498 16.9025 17.4545 16.7299 17.4545H15.0985C14.9416 17.4545 14.8475 17.3498 14.8475 17.1753V3.77018C14.8475 3.59564 14.9416 3.49091 15.0985 3.49091H16.6515C16.7927 3.49091 16.8868 3.56073 16.9338 3.71782L19.3183 11.136H19.4124V3.77018C19.4124 3.59564 19.4908 3.49091 19.6634 3.49091Z" /><path d="M11.8999 3.49091H13.4686C13.7039 3.49091 13.8137 3.648 13.7196 3.89236L10.8489 11.6596V17.1055C10.8489 17.3324 10.7391 17.4545 10.5351 17.4545H9.0292C8.82527 17.4545 8.71546 17.3324 8.71546 17.1055V11.6596L5.84474 3.89236C5.75062 3.648 5.86043 3.49091 6.09574 3.49091H7.66443C7.85268 3.49091 7.96249 3.57818 8.02523 3.77018L9.78217 8.77964L11.5391 3.77018C11.6019 3.57818 11.7117 3.49091 11.8999 3.49091Z" /><path d="M2.13343 14.9324H5.86693C6.03948 14.9324 6.11792 15.0371 6.11792 15.2116V16.9571C6.11792 17.1491 6.03948 17.2364 5.86693 17.2364H0.250991C0.09412 17.2364 0 17.1491 0 16.9571V3.552C0 3.37745 0.09412 3.27273 0.250991 3.27273H1.88244C2.05499 3.27273 2.13343 3.37745 2.13343 3.552V14.9324Z" /></svg>
            <p className="text-[20px] leading-[30px]" style={{ fontFamily: "'Inter', sans-serif" }}>2026 LYNKS</p>
            <div className="flex items-center gap-3">
              <a href="https://www.instagram.com/lynks.tt/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="black"><path d="M8 4.30769C7.26973 4.30769 6.55586 4.52424 5.94866 4.92996C5.34147 5.33567 4.86821 5.91233 4.58875 6.58702C4.30929 7.2617 4.23617 8.0041 4.37864 8.72033C4.52111 9.43657 4.87277 10.0945 5.38914 10.6109C5.90552 11.1272 6.56343 11.4789 7.27967 11.6214C7.9959 11.7638 8.7383 11.6907 9.41298 11.4112C10.0877 11.1318 10.6643 10.6585 11.07 10.0513C11.4758 9.44414 11.6923 8.73027 11.6923 8C11.6913 7.02105 11.302 6.08249 10.6097 5.39027C9.91751 4.69805 8.97895 4.30871 8 4.30769ZM8 10.4615C7.51315 10.4615 7.03724 10.3172 6.63244 10.0467C6.22765 9.77622 5.91214 9.39178 5.72583 8.94199C5.53953 8.4922 5.49078 7.99727 5.58576 7.51978C5.68074 7.04229 5.91518 6.60368 6.25943 6.25943C6.60368 5.91518 7.04229 5.68074 7.51978 5.58576C7.99727 5.49078 8.4922 5.53953 8.94199 5.72583C9.39178 5.91214 9.77622 6.22765 10.0467 6.63244C10.3172 7.03724 10.4615 7.51315 10.4615 8C10.4615 8.65284 10.2022 9.27894 9.74057 9.74057C9.27894 10.2022 8.65284 10.4615 8 10.4615ZM11.6923 0H4.30769C3.1656 0.00122 2.07063 0.45546 1.26304 1.26304C0.45546 2.07063 0.00122 3.1656 0 4.30769V11.6923C0.00122 12.8344 0.45546 13.9294 1.26304 14.737C2.07063 15.5445 3.1656 15.9988 4.30769 16H11.6923C12.8344 15.9988 13.9294 15.5445 14.737 14.737C15.5445 13.9294 15.9988 12.8344 16 11.6923V4.30769C15.9988 3.1656 15.5445 2.07063 14.737 1.26304C13.9294 0.45546 12.8344 0.00122 11.6923 0ZM14.7692 11.6923C14.7692 12.5084 14.4451 13.291 13.868 13.868C13.291 14.4451 12.5084 14.7692 11.6923 14.7692H4.30769C3.49164 14.7692 2.70901 14.4451 2.13198 13.868C1.55494 13.291 1.23077 12.5084 1.23077 11.6923V4.30769C1.23077 3.49164 1.55494 2.70901 2.13198 2.13198C2.70901 1.55494 3.49164 1.23077 4.30769 1.23077H11.6923C12.5084 1.23077 13.291 1.55494 13.868 2.13198C14.4451 2.70901 14.7692 3.49164 14.7692 4.30769V11.6923ZM12.9231 4C12.9231 4.18257 12.8689 4.36103 12.7675 4.51283C12.6661 4.66463 12.5219 4.78295 12.3532 4.85281C12.1846 4.92268 11.999 4.94096 11.8199 4.90534C11.6409 4.86972 11.4764 4.78181 11.3473 4.65271C11.2182 4.52362 11.1303 4.35914 11.0947 4.18008C11.059 4.00102 11.0773 3.81542 11.1472 3.64675C11.2171 3.47808 11.3354 3.33392 11.4872 3.23249C11.639 3.13106 11.8174 3.07692 12 3.07692C12.2448 3.07692 12.4796 3.17418 12.6527 3.34729C12.8258 3.5204 12.9231 3.75518 12.9231 4Z" /></svg>
              </a>
              <a href="mailto:lynkstt@gmail.com" className="hover:opacity-70 transition-opacity">
                <svg width="17" height="12" viewBox="0 0 17 12" fill="black"><path d="M16.3462 0H0.653846C0.480435 0 0.314127 0.06321 0.191507 0.17574C0.06889 0.28826 0 0.44087 0 0.6V10.8C0 11.1183 0.13777 11.4235 0.38301 11.6485C0.62825 11.8736 0.96087 12 1.30769 12H15.6923C16.0391 12 16.3717 11.8736 16.617 11.6485C16.8622 11.4235 17 11.1183 17 10.8V0.6C17 0.44087 16.9311 0.28826 16.8085 0.17574C16.6859 0.06321 16.5196 0 16.3462 0ZM8.5 6.38625L2.33505 1.2H14.665L8.5 6.38625ZM6.10611 6L1.30769 10.0358V1.96425L6.10611 6ZM7.0738 6.81375L8.05457 7.6425C8.1752 7.74411 8.33298 7.8005 8.49673 7.8005C8.66048 7.8005 8.81827 7.74411 8.93889 7.6425L9.91966 6.81375L14.66 10.8H2.33505L7.0738 6.81375ZM10.8939 6L15.6923 1.9635V10.0365L10.8939 6Z" /></svg>
              </a>
            </div>
          </div>
        </footer>

        {/* Login Modal */}
        {showLogin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLogin(false)}>
            <div className="bg-white rounded-3xl p-10 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-[28px] font-semibold text-[#0D0026] mb-2" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 600 }}>Log in</h2>
              <p className="text-sm text-[rgba(30,30,30,0.6)] mb-8">Welcome back! Sign in to continue your journey.</p>
              <div className="flex flex-col gap-5">
                <div>
                  <label className="text-sm font-semibold text-[rgba(30,30,30,0.8)] block mb-2">Email Address</label>
                  <input type="email" placeholder="email@gmail.com" value={loginForm.email} onChange={(e) => setLoginForm(p => ({ ...p, email: e.target.value }))} className="w-full p-3.5 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] text-[15px] focus:outline-none focus:border-[#6B26EA] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[rgba(30,30,30,0.8)] block mb-2">Password</label>
                  <input type="password" placeholder="••••••••" value={loginForm.password} onChange={(e) => setLoginForm(p => ({ ...p, password: e.target.value }))} className="w-full p-3.5 rounded-[10px] border border-[rgba(0,0,0,0.20)] bg-[rgba(215,212,212,0.10)] text-[15px] focus:outline-none focus:border-[#6B26EA] transition-colors" style={{ fontFamily: "'Inter', sans-serif" }} />
                </div>
                <Link href="/login" className="w-full py-3 rounded-[20px] bg-[#EADFFF] border border-[rgba(0,0,0,0.43)] text-sm font-medium hover:bg-[#D4C4F7] transition-colors cursor-pointer text-center block" style={{ fontFamily: "'Helvetica Now Display', 'Inter', sans-serif" }}>
                  Continue
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
