'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useChat } from './hooks/useChat'
import { useVoice } from './hooks/useVoice'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import styles from './chat.module.css'

const SEED_QUESTIONS = [
  '◈  What are Sacred Orders?',
  '⊕  How does LangGraph orchestrate?',
  '△  What makes Vitruvyan domain-agnostic?',
  '◉  How does the epistemic pipeline work?',
]

interface Props {
  onAudioLevel?: (level: number) => void
}

export default function Chat({ onAudioLevel }: Props) {
  const { messages, isProcessing, sendMessage } = useChat()
  const [speakingLevel, setSpeakingLevel] = useState(0)
  const [pendingTranscript, setPendingTranscript] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleAudioLevel = useCallback((level: number) => {
    setSpeakingLevel(level)
    onAudioLevel?.(level)
  }, [onAudioLevel])

  const handleTranscript = useCallback((text: string) => {
    setPendingTranscript(text)
  }, [])

  const { isRecording, startRecording, stopRecording, speakText } = useVoice(
    handleTranscript,
    handleAudioLevel,
  )

  // Auto-submit when transcript arrives
  useEffect(() => {
    if (pendingTranscript) {
      sendMessage(pendingTranscript)
      setPendingTranscript('')
    }
  }, [pendingTranscript, sendMessage])

  // Speak last AI response
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.sender === 'ai' && last.isComplete && last.text) {
      speakText(last.text, setSpeakingLevel)
    }
  }, [messages, speakText])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const handleMic = useCallback(() => {
    isRecording ? stopRecording() : startRecording()
  }, [isRecording, startRecording, stopRecording])

  const hasMessages = messages.length > 0

  return (
    <div className={styles.chatWrap}>
      {/* Messages or empty state */}
      {hasMessages ? (
        <div className={styles.messages}>
          {messages.map(msg => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onRelatedClick={sendMessage}
              speakingLevel={msg.sender === 'ai' && msg.isComplete && msg === messages[messages.length - 1] ? speakingLevel : 0}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.seedLabel}>Start exploring</span>
          <div className={styles.seedGrid}>
            {SEED_QUESTIONS.map(q => (
              <button key={q} className={styles.seedPill} onClick={() => sendMessage(q.replace(/^[◈⊕△◉]\s+/, ''))}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        isProcessing={isProcessing}
        isRecording={isRecording}
        onMicClick={handleMic}
      />
    </div>
  )
}
