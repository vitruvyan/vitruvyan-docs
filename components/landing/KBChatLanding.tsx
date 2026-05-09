'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useChat } from '../chat/hooks/useChat'
import { useVoice } from '../chat/hooks/useVoice'
import { ChatMessage } from '../chat/ChatMessage'
import styles from '../../styles/kb-chat.module.css'

const ChatInputDynamic = dynamic(
  () => import('../chat/ChatInput').then(m => ({ default: m.ChatInput })),
  { ssr: false }
)
const GaussianCanvas = dynamic(() => import('./GaussianCanvas'), { ssr: false })

const SEED_QUESTIONS = [
  { icon: '◈', label: 'What are Sacred Orders?' },
  { icon: '⊕', label: 'How does LangGraph orchestrate?' },
  { icon: '△', label: 'What makes Vitruvyan domain-agnostic?' },
  { icon: '◉', label: 'How does the epistemic pipeline work?' },
]

export function KBChatLanding() {
  const { messages, isProcessing, sendMessage } = useChat()
  const [audioLevel, setAudioLevel] = useState(0)
  const [pendingTranscript, setPendingTranscript] = useState('')
  const [isClient, setIsClient] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasMessages = messages.length > 0

  useEffect(() => {
    setIsClient(true)
    // Prevent page scroll — chat is self-contained in viewport
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const { isRecording, startRecording, stopRecording, speakText } = useVoice(
    setPendingTranscript,
    setAudioLevel,
  )

  useEffect(() => {
    if (pendingTranscript) {
      sendMessage(pendingTranscript)
      setPendingTranscript('')
    }
  }, [pendingTranscript, sendMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const handleMic = useCallback(() => {
    isRecording ? stopRecording() : startRecording()
  }, [isRecording, startRecording, stopRecording])

  return (
    <div className={hasMessages ? styles.pageActive : styles.page}>

      {/* Background animation — fixed behind everything */}
      <GaussianCanvas audioLevel={audioLevel} />

      {/* ── EMPTY STATE: title + input + pills centered as one unit ── */}
      {!hasMessages && (
        <div className={styles.centerUnit}>
          <div className={styles.hero}>
            <h1 className={styles.title}>Explore Vitruvyan</h1>
            <p className={styles.subtitle}>
              Discover the platform through natural conversation — or browse the docs on the left
            </p>
          </div>

          <div className={styles.inputWrap}>
            {isClient && (
              <ChatInputDynamic
                onSend={sendMessage}
                isProcessing={isProcessing}
                isRecording={isRecording}
                onMicClick={handleMic}
                placeholder="Ask about Vitruvyan..."
              />
            )}
            <div className={styles.pills}>
              {SEED_QUESTIONS.map(q => (
                <button key={q.label} className={styles.pill} onClick={() => sendMessage(q.label)}>
                  <span className={styles.pillIcon}>{q.icon}</span>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE STATE: conversation + sticky input ── */}
      {hasMessages && (
        <>
          <div className={styles.conversation}>
            {messages.map((msg, i) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onRelatedClick={sendMessage}
                speakingLevel={
                  msg.sender === 'ai' && msg.isComplete && i === messages.length - 1
                    ? audioLevel : 0
                }
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputSection}>
            {isClient && (
              <ChatInputDynamic
                onSend={sendMessage}
                isProcessing={isProcessing}
                isRecording={isRecording}
                onMicClick={handleMic}
                placeholder="Ask about Vitruvyan..."
              />
            )}
            <div className={styles.pills}>
              {SEED_QUESTIONS.map(q => (
                <button key={q.label} className={styles.pill} onClick={() => sendMessage(q.label)}>
                  <span className={styles.pillIcon}>{q.icon}</span>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
