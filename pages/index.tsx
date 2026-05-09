import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useTheme } from 'nextra-theme-docs'
import styles from '../styles/landing.module.css'

// Dynamic imports — both components use browser APIs
const GaussianCanvas = dynamic(() => import('../components/landing/GaussianCanvas'), { ssr: false })
const Chat = dynamic(() => import('../components/chat/Chat'), { ssr: false })

export default function LandingPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [audioLevel, setAudioLevel] = useState(0)

  const handleAudioLevel = useCallback((level: number) => {
    setAudioLevel(level)
  }, [])

  return (
    <>
      <Head>
        <title>Vitruvyan OS</title>
        <meta name="description" content="Domain-agnostic epistemic operating system — explore the Vitruvyan platform through natural conversation." />
      </Head>

      <div className={styles.landing}>
        {/* Full-screen gaussian animation */}
        <GaussianCanvas audioLevel={audioLevel} />

        {/* Hero */}
        <div className={styles.hero}>
          <img
            src="/vit_logo_header.svg"
            alt="Vitruvyan"
            className={styles.logo}
            style={{ filter: isDark ? 'invert(1) brightness(1.1)' : 'none' }}
          />
          <p className={styles.headline}>
            Explore the Vitruvyan platform through natural conversation
          </p>
          <p className={styles.subline}>
            Ask in any language · or speak directly with your voice
          </p>
        </div>

        {/* Chat panel */}
        <div className={styles.chatPanel}>
          <Chat onAudioLevel={handleAudioLevel} />
        </div>
      </div>
    </>
  )
}
