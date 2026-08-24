import type { Metadata } from 'next'
import { DM_Sans, Bricolage_Grotesque } from 'next/font/google'
import Providers from '@/components/providers'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bricolage',
})

export const metadata: Metadata = {
  title: 'LYNKS — AI Career Accelerator',
  description: 'AI-powered career accelerator for Caribbean youth',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${bricolage.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}