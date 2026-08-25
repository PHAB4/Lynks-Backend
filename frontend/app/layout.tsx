import { Inter, Google_Sans_Flex } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' })
const googleSansFlex = Google_Sans_Flex({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-google-sans-flex' })

export const metadata = { title: 'LYNKS', description: 'AI-powered career accelerator for Caribbean youth' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${googleSansFlex.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&family=Birthstone&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-[#F7F3FE] text-[#0D0026]">{children}</body>
    </html>
  )
}
