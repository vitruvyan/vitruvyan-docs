'use client'

import { useTheme } from 'nextra-theme-docs'
import type { Message } from './hooks/useMessages'
import { SoundWave } from './SoundWave'
import styles from './chat.module.css'

interface Props {
  message: Message
  onRelatedClick: (q: string) => void
  speakingLevel?: number
}

const THINKING_ICON: Record<string, string> = {
  'Searching documentation...': '◈',
  'Reading context...': '⊕',
  'Writing answer...': '◉',
}

export function ChatMessage({ message, onRelatedClick, speakingLevel = 0 }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const isUser = message.sender === 'user'

  if (isUser) {
    return (
      <div className={styles.userMsg}>
        <span className={styles.userBubble}>{message.text}</span>
      </div>
    )
  }

  // Thinking state
  if (message.isStreaming && message.thinkingStep) {
    return (
      <div className={styles.aiMsg}>
        <div className={styles.thinkingWrap}>
          <span className={styles.thinkingIcon}>
            {THINKING_ICON[message.thinkingStep] || '◈'}
          </span>
          <span className={styles.thinkingLabel}>{message.thinkingStep}</span>
          <span className={styles.thinkingDots}>
            <span /><span /><span />
          </span>
        </div>
      </div>
    )
  }

  // Error state
  if (message.error) {
    return (
      <div className={styles.aiMsg}>
        <p className={styles.errorText}>{message.error}</p>
      </div>
    )
  }

  // Complete AI response
  return (
    <div className={styles.aiMsg}>
      {/* Answer text */}
      <p className={styles.answerText}>{message.text}</p>

      {/* Sound wave when TTS is playing */}
      {speakingLevel > 0 && (
        <div className={styles.soundWaveWrap}>
          <SoundWave level={speakingLevel} isDark={isDark} />
        </div>
      )}

      {/* Sources */}
      {message.sources && message.sources.length > 0 && (
        <div className={styles.sourcesWrap}>
          <span className={styles.sourcesLabel}>Sources</span>
          <div className={styles.sourcesList}>
            {message.sources.map(s => (
              <a key={s.url} href={s.url} className={styles.sourceLink} target="_self">
                {s.title || s.url}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Related pills */}
      {message.related && message.related.length > 0 && (
        <div className={styles.relatedWrap}>
          <span className={styles.relatedLabel}>Related</span>
          <div className={styles.relatedList}>
            {message.related.map(q => (
              <button key={q} className={styles.pill} onClick={() => onRelatedClick(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
