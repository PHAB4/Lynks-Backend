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

const FULL_LOGO = (
  <img src="/lynks-full-logo.jpg" alt="LYNKS" className="h-5 w-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
)

const CHAIN_LINK_LOGO = (
  <img src="/lynks-chain-link.jpg" alt="Lynks" className="h-6 w-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
)

const INSTAGRAM_SVG = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="black">
    <path d="M8 4.30769C7.26973 4.30769 6.55586 4.52424 5.94866 4.92996C5.34147 5.33567 4.86821 5.91233 4.58875 6.58702C4.30929 7.2617 4.23617 8.0041 4.37864 8.72033C4.52111 9.43657 4.87277 10.0945 5.38914 10.6109C5.90552 11.1272 6.56343 11.4789 7.27967 11.6214C7.9959 11.7638 8.7383 11.6907 9.41298 11.4112C10.0877 11.1318 10.6643 10.6585 11.07 10.0513C11.4758 9.44414 11.6923 8.73027 11.6923 8C11.6913 7.02105 11.302 6.08249 10.6097 5.39027C9.91751 4.69805 8.97895 4.30871 8 4.30769ZM8 10.4615C7.51315 10.4615 7.03724 10.3172 6.63244 10.0467C6.22765 9.77622 5.91214 9.39178 5.72583 8.94199C5.53953 8.4922 5.49078 7.99727 5.58576 7.51978C5.68074 7.04229 5.91518 6.60368 6.25943 6.25943C6.60368 5.91518 7.04229 5.68074 7.51978 5.58576C7.99727 5.49078 8.4922 5.53953 8.94199 5.72583C9.39178 5.91214 9.77622 6.22765 10.0467 6.63244C10.3172 7.03724 10.4615 7.51315 10.4615 8C10.4615 8.65284 10.2022 9.27894 9.74057 9.74057C9.27894 10.2022 8.65284 10.4615 8 10.4615ZM11.6923 0H4.30769C3.1656 0.00122 2.07063 0.45546 1.26304 1.26304C0.45546 2.07063 0.00122 3.1656 0 4.30769V11.6923C0.00122 12.8344 0.45546 13.9294 1.26304 14.737C2.07063 15.5445 3.1656 15.9988 4.30769 16H11.6923C12.8344 15.9988 13.9294 15.5445 14.737 14.737C15.5445 13.9294 15.9988 12.8344 16 11.6923V4.30769C15.9988 3.1656 15.5445 2.07063 14.737 1.26304C13.9294 0.45546 12.8344 0.00122 11.6923 0ZM14.7692 11.6923C14.7692 12.5084 14.4451 13.291 13.868 13.868C13.291 14.4451 12.5084 14.7692 11.6923 14.7692H4.30769C3.49164 14.7692 2.70901 14.4451 2.13198 13.868C1.55494 13.291 1.23077 12.5084 1.23077 11.6923V4.30769C1.23077 3.49164 1.55494 2.70901 2.13198 2.13198C2.70901 1.55494 3.49164 1.23077 4.30769 1.23077H11.6923C12.5084 1.23077 13.291 1.55494 13.868 2.13198C14.4451 2.70901 14.7692 3.49164 14.7692 4.30769V11.6923ZM12.9231 4C12.9231 4.18257 12.8689 4.36103 12.7675 4.51283C12.6661 4.66463 12.5219 4.78295 12.3532 4.85281C12.1846 4.92268 11.999 4.94096 11.8199 4.90534C11.6409 4.86972 11.4764 4.78181 11.3473 4.65271C11.2182 4.52362 11.1303 4.35914 11.0947 4.18008C11.059 4.00102 11.0773 3.81542 11.1472 3.64675C11.2171 3.47808 11.3354 3.33392 11.4872 3.23249C11.639 3.13106 11.8174 3.07692 12 3.07692C12.2448 3.07692 12.4796 3.17418 12.6527 3.34729C12.8258 3.5204 12.9231 3.75518 12.9231 4Z" />
  </svg>
)

const LINK_SVG = (
  <svg width="13" height="14" viewBox="0 0 13 14" fill="black">
    <path d="M12.5 3.62963C11.7046 3.62877 10.942 3.30072 10.3796 2.71746C9.81716 2.1342 9.50083 1.34337 9.5 0.518519C9.5 0.380999 9.44732 0.249112 9.35355 0.151871C9.25979 0.0546294 9.13261 0 9 0H6.5C6.36739 0 6.24021 0.0546294 6.14645 0.151871C6.05268 0.249112 6 0.380999 6 0.518519V9.07407C5.9999 9.30604 5.93978 9.53372 5.82591 9.73338C5.71205 9.93303 5.54861 10.0973 5.35264 10.2092C5.15667 10.321 4.93536 10.3763 4.71179 10.3692C4.48822 10.3621 4.27057 10.2929 4.08156 10.1689C3.89255 10.0448 3.7391 9.87046 3.63721 9.66396C3.53533 9.45746 3.48873 9.22639 3.5023 8.99486C3.51587 8.76332 3.58909 8.5398 3.71434 8.34762C3.83959 8.15543 4.01227 8.00162 4.21438 7.90222C4.29987 7.86015 4.37209 7.79378 4.42265 7.71083C4.47321 7.62787 4.50003 7.53175 4.5 7.43361V4.66667C4.50003 4.59087 4.48404 4.51599 4.45315 4.4473C4.42226 4.37861 4.37722 4.31777 4.32121 4.26908C4.2652 4.22038 4.19958 4.18502 4.12896 4.16547C4.05835 4.14592 3.98446 4.14266 3.9125 4.15593C1.68187 4.56815 0 6.68241 0 9.07407C0 10.3805 0.500445 11.6334 1.39124 12.5572C2.28204 13.481 3.49022 14 4.75 14C6.00978 14 7.21796 13.481 8.10876 12.5572C8.99955 11.6334 9.5 10.3805 9.5 9.07407V6.50028C10.426 7.00132 11.4555 7.26177 12.5 7.25926C12.6326 7.25926 12.7598 7.20463 12.8536 7.10739C12.9473 7.01015 13 6.87826 13 6.74074V4.14815C13 4.01063 12.9473 3.87874 12.8536 3.7815C12.7598 3.68426 12.6326 3.62963 12.5 3.62963ZM12 6.19889C11.0229 6.1091 10.0873 5.74746 9.29187 5.15213C9.21711 5.09639 9.12896 5.06314 9.03714 5.05605C8.94532 5.04895 8.85339 5.06829 8.77149 5.11193C8.68959 5.15557 8.6209 5.22181 8.573 5.30336C8.52509 5.38491 8.49983 5.47859 8.5 5.57407V9.07407C8.5 10.1055 8.10491 11.0946 7.40165 11.8239C6.69839 12.5532 5.74456 12.963 4.75 12.963C3.75544 12.963 2.80161 12.5532 2.09835 11.8239C1.39509 11.0946 1 10.1055 1 9.07407C1 7.39537 2.04 5.88972 3.5 5.34074V7.13417C3.17678 7.35812 2.91503 7.6651 2.74025 8.02518C2.56547 8.38526 2.48363 8.78616 2.50271 9.1888C2.52179 9.59144 2.64113 9.98208 2.84911 10.3227C3.05708 10.6632 3.3466 10.9421 3.68943 11.1321C4.03226 11.3222 4.41672 11.4168 4.80533 11.4069C5.19394 11.397 5.57344 11.2828 5.90685 11.0756C6.24026 10.8683 6.5162 10.575 6.70778 10.2242C6.89936 9.87346 7.00004 9.4772 7 9.07407V1.03704H8.53125C8.6437 1.95033 9.04532 2.79908 9.6731 3.45011C10.3009 4.10115 11.1193 4.51765 12 4.63426V6.19889Z" />
  </svg>
)

const ENVELOPE_SVG = (
  <svg width="17" height="12" viewBox="0 0 17 12" fill="black">
    <path d="M16.3462 0H0.653846C0.480435 0 0.314127 0.06321 0.191507 0.17574C0.06889 0.28826 0 0.44087 0 0.6V10.8C0 11.1183 0.13777 11.4235 0.38301 11.6485C0.62825 11.8736 0.96087 12 1.30769 12H15.6923C16.0391 12 16.3717 11.8736 16.617 11.6485C16.8622 11.4235 17 11.1183 17 10.8V0.6C17 0.44087 16.9311 0.28826 16.8085 0.17574C16.6859 0.06321 16.5196 0 16.3462 0ZM8.5 6.38625L2.33505 1.2H14.665L8.5 6.38625ZM6.10611 6L1.30769 10.0358V1.96425L6.10611 6ZM7.0738 6.81375L8.05457 7.6425C8.1752 7.74411 8.33298 7.8005 8.49673 7.8005C8.66048 7.8005 8.81827 7.74411 8.93889 7.6425L9.91966 6.81375L14.66 10.8H2.33505L7.0738 6.81375ZM10.8939 6L15.6923 1.9635V10.0365L10.8939 6Z" />
  </svg>
)

export default function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  const features = [
    {
      label: 'Notifications',
      title: 'Get notified and even be reminded about incomplete tasks',
      description: 'As you traverse through your career journey, our systems stay up to date with opportunities to carry you along your career journey and notify you of such. It also notifies you of tasks that you may still have to complete to continue, along your career journey.',
      image: '/images/OxA7NlDbOxTaTU6TLtJ6Bf0vvI.png',
      barClass: 'feature-bar-purple',
      textSide: 'left' as const,
    },
    {
      label: 'Resume writing',
      title: 'Get usable resumes with the click of a button',
      description: 'Our systems are not only capable of creating resumes for the user, It also continuously updates the users resume according to the tasks the user completed along their career journey',
      image: '/images/lY89a5i4dJFJRvKsqqmRte78SI.png',
      barClass: 'feature-bar-gray',
      textSide: 'right' as const,
    },
    {
      label: 'Tasks',
      title: 'Lynks guides you every step of the way',
      description: 'By mapping out each step on the career roadmap Lynks keeps the user on task while making the process personal and more enjoyable. Furthermore, with the assistance of our on chat box system the user has the option to ask questions about their career process while being informed fully about application processes and other opportunities',
      image: '/images/LNFMMqlJPosVeR1MkDOtzG9OmX4.png',
      barClass: 'feature-bar-light',
      textSide: 'left' as const,
    },
    {
      label: 'Stay informed',
      title: 'Keep up to date with opportunities as they appear',
      description: 'Stay informed about all opportunities in your area not only for the sake of employment but for the personal development. Lynks makes you aware of opportunities opening your mind to other paths not only those in your field of interest',
      image: '/images/VATig1fwVrqP6Ni30VbZR37tals.png',
      barClass: 'feature-bar-gray',
      textSide: 'right' as const,
    },
  ]

  return (
    <>
      {/* Sticky nav pill */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-5 pt-4">
        <nav className="nav-pill flex items-center justify-between w-full max-w-[1000px] px-5 py-3 bg-[#f9f5ff]/80">
          <div className="flex items-center gap-1">
            {FULL_LOGO}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[#8b898e] text-sm hover:text-[#0d0026] transition-colors"
              style={{ fontFamily: "'Google Sans Flex', sans-serif" }}
            >
              Login
            </Link>
            <div className="w-[2px] h-[2px] rounded-full bg-[#ccc]" />
            <Link
              href="/signup"
              className="bg-[#6b26ea] text-white text-sm px-5 py-2 rounded-full hover:bg-[#5a1fd0] transition-colors"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Sign up
            </Link>
          </div>
        </nav>
      </div>

      {/* Hero section */}
      <div className="flex flex-col items-center bg-[#f9f5ff] min-h-screen w-full overflow-hidden relative z-10">
        <div ref={heroRef} className="relative w-full h-[739px] overflow-hidden">
          <div className="absolute inset-0 hero-checkerboard" />
          <div
            className="cursor-glow"
            style={{
              left: heroRef.current ? mousePos.x - heroRef.current.getBoundingClientRect().left - 200 : mousePos.x - 200,
              top: heroRef.current ? mousePos.y - heroRef.current.getBoundingClientRect().top - 200 : mousePos.y - 200,
              opacity: mousePos.x === 0 && mousePos.y === 0 ? 0 : 1,
            }}
          />
          <div className="absolute top-[265px] left-[435px]">
            <p className="text-[128px] leading-[55px] text-[#6b26ea]" style={{ fontFamily: "'Birthstone', cursive" }}>
              {"Let's".split('').map((char, i) => (
                <span key={i} className="hero-letter" style={{ animationDelay: `${i * 0.08}s` }}>{char}</span>
              ))}
            </p>
          </div>
          <div className="absolute top-1/2 left-[587px] -translate-y-1/2">
            <h1 className="text-[96px] leading-[55px] font-semibold text-[#0d0026]" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 600 }}>
              {"Lynk".split('').map((char, i) => (
                <span key={i} className="hero-letter" style={{ animationDelay: `${0.4 + i * 0.08}s` }}>{char}</span>
              ))}
            </h1>
          </div>
          <Link
            href="/onboarding"
            className="absolute bottom-[123px] left-1/2 -translate-x-1/2 bg-[#6b26ea] text-white text-sm rounded-full hover:bg-[#5a1fd0] transition-colors"
            style={{ fontFamily: "'Helvetica Now Display', 'Inter', sans-serif", width: 130, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Get started
          </Link>
        </div>

        {/* Tagline bar */}
        <div className="w-full bg-[#6b26ea] py-[34px] px-12 flex justify-center">
          <div className="blind-reveal-bar w-full max-w-[800px] flex justify-center">
            <h2 className="relative z-10 text-white/90 text-[29px] font-medium leading-[130%] text-center" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 500 }}>
              Get connected, get informed and receive guidance. Make your career journey easier than its ever been
            </h2>
            <div className="reveal-mask" />
          </div>
        </div>

        {/* Feature sections */}
        {features.map((feature, i) => (
          <AnimatedSection key={i} delay={i * 100}>
            <div className="w-full flex justify-center px-5 my-3">
              <div className={`${feature.barClass} w-full max-w-[1200px] flex items-stretch overflow-hidden min-h-[480px]`}>
                {feature.textSide === 'right' ? (
                  <>
                    <div className="flex-1 relative overflow-hidden">
                      <img src={feature.image} alt={feature.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 flex flex-col justify-end items-end gap-6 p-12 text-right">
                      <span className="text-bubble text-white text-[20px] font-semibold" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 600 }}>{feature.label}</span>
                      <h3 className="text-[25px] font-bold leading-[40px] text-[#0d0026] max-w-[526px]" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}>{feature.title}</h3>
                      <p className="text-[16px] leading-[30px] text-[rgba(0,0,0,0.6)] max-w-[526px]" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>{feature.description}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 flex flex-col justify-center items-start gap-6 p-12 text-left">
                      <span className="text-bubble text-white text-[20px] font-semibold" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 600 }}>{feature.label}</span>
                      <h3 className="text-[25px] font-bold leading-[40px] text-[#0d0026] max-w-[526px]" style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}>{feature.title}</h3>
                      <p className="text-[16px] leading-[30px] text-[rgba(0,0,0,0.6)] max-w-[526px]" style={{ fontFamily: "'Google Sans Flex', sans-serif" }}>{feature.description}</p>
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                      <img src={feature.image} alt={feature.label} className="w-full h-full object-cover" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </AnimatedSection>
        ))}

        <div className="w-full h-[203px] bg-[#f9f5ff]" />

        {/* Footer */}
        <footer className="w-full bg-[#e0e0e0] py-5 px-5">
          <div className="flex items-center justify-between max-w-[1200px] mx-auto">
            <div className="flex items-center gap-0.5">
              {CHAIN_LINK_LOGO}
            </div>
            <p className="text-[20px] leading-[30px] text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
              &nbsp;&nbsp;&nbsp;2026 LYNKS
            </p>
            <div className="flex items-center gap-2">
              <a href="https://www.instagram.com/lynks.tt/" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                {INSTAGRAM_SVG}
              </a>
              <span className="text-black/40 text-xs">{LINK_SVG}</span>
              <a href="mailto:lynkstt@gmail.com" className="hover:opacity-70 transition-opacity">
                {ENVELOPE_SVG}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
