import { useState, useCallback } from 'react'

export interface KBSource {
  url: string
  title: string
  score: number
}

export interface Message {
  id: string
  sender: 'user' | 'ai'
  text: string
  sources?: KBSource[]
  related?: string[]
  isComplete: boolean
  isStreaming?: boolean
  error?: string
  thinkingStep?: string
}

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)

  const addUserMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      isComplete: true,
    }])
  }, [])

  const addAIPlaceholder = useCallback(() => {
    const id = `ai-${Date.now()}`
    setMessages(prev => [...prev, {
      id,
      sender: 'ai',
      text: '',
      isComplete: false,
      isStreaming: true,
      thinkingStep: 'Searching documentation...',
    }])
    return id
  }, [])

  const updateLastAI = useCallback((patch: Partial<Message>) => {
    setMessages(prev => {
      const next = [...prev]
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].sender === 'ai') {
          next[i] = { ...next[i], ...patch }
          break
        }
      }
      return next
    })
  }, [])

  return { messages, isTyping, setIsTyping, addUserMessage, addAIPlaceholder, updateLastAI }
}
