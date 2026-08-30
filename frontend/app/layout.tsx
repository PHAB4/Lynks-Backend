import { DM_Sans, Bricolage_Grotesque, Google_Sans_Flex, Helvetica_Now_Display, Inter } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-dm-sans' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-bricolage' })
const googleSansFlex = Google_Sans_Flex({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-google-sans-flex' })
const helveticaNowDisplay = Helvetica_Now_Display({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-helvetica-now-display' })
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' })

export const metadata = { title: 'LYNKS', description: 'AI-powered career accelerator for Caribbean youth' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${bricolage.variable} ${googleSansFlex.variable} ${helveticaNowDisplay.variable} ${inter.variable}`}><body className="font-sans antialiased bg-[#F7F3FE] text-[#0D0026]">{children}</body></html>
  )
}
