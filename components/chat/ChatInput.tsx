'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Mic, MicOff } from 'lucide-react'
import styles from './chat.module.css'

interface Props {
  onSend: (text: string) => void
  isProcessing: boolean
  isRecording: boolean
  onMicClick: () => void
  placeholder?: string
}

export function ChatInput({ onSend, isProcessing, isRecording, onMicClick, placeholder = 'Ask about Vitruvyan...' }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = useCallback(() => {
    if (!value.trim() || isProcessing) return
    onSend(value.trim())
    setValue('')
  }, [value, isProcessing, onSend])

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }, [submit])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  return (
    <div className={styles.inputWrap}>
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          disabled={isProcessing}
          rows={1}
          className={styles.textarea}
        />

        <button
          onClick={onMicClick}
          className={`${styles.iconBtn} ${isRecording ? styles.iconBtnActive : ''}`}
          title={isRecording ? 'Stop recording' : 'Voice input'}
          type="button"
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          onClick={submit}
          disabled={!value.trim() || isProcessing}
          className={styles.sendBtn}
          type="button"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
