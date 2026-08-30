import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F7F3FE',
        foreground: '#0D0026',
        primary: {
          DEFAULT: '#6B26EA',
          light: '#EADFFF',
          dark: '#5A1FD0',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F9F5FF',
          muted: '#F6F5F8',
        },
        border: {
          DEFAULT: '#EDE3FF',
          strong: 'rgba(0,0,0,0.30)',
        },
        'text-primary': '#0D0026',
        'text-secondary': '#8B898E',
        'text-muted': '#A8A8A8',
        'text-faint': 'rgba(0,0,0,0.50)',
        'text-input': 'rgba(0,0,0,0.30)',
        link: '#0099FF',
      },
      borderRadius: {
        lg: '15px',
        md: '10px',
        sm: '8px',
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Bricolage Grotesque', 'Google Sans Flex', 'Inter', 'system-ui', 'sans-serif'],
        googleSansFlex: ['var(--font-google-sans-flex)', 'sans-serif'],
        helveticaNowDisplay: ['var(--font-helvetica-now-display)', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config