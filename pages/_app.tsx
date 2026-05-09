import { Inter, Libre_Baskerville } from 'next/font/google'
import type { AppProps } from 'next/app'
import '../styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const libreBaskerville = Libre_Baskerville({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} ${libreBaskerville.variable}`} style={{ display: 'contents' }}>
      <Component {...pageProps} />
    </div>
  )
}
