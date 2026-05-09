import { useCallback } from 'react'
import { useMessages } from './useMessages'

const THINKING_STEPS = [
  'Searching documentation...',
  'Reading context...',
  'Writing answer...',
]

export function useChat() {
  const { messages, isTyping, setIsTyping, addUserMessage, addAIPlaceholder, updateLastAI } = useMessages()

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return

    addUserMessage(text)
    setIsTyping(true)
    addAIPlaceholder()

    // Animate thinking steps
    for (const step of THINKING_STEPS) {
      updateLastAI({ thinkingStep: step, isStreaming: true, isComplete: false })
      await new Promise(r => setTimeout(r, 700))
    }

    try {
      const res = await fetch('/api/kb-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text.trim() }),
      })
      const data = await res.json()

      if (!res.ok || data.status === 'error') {
        throw new Error(data.error || 'Unknown error')
      }

      updateLastAI({
        text: data.answer || '',
        sources: data.sources || [],
        related: data.related || [],
        isComplete: true,
        isStreaming: false,
        thinkingStep: undefined,
      })
    } catch (err: any) {
      updateLastAI({
        text: '',
        error: err.message || 'Something went wrong. Please try again.',
        isComplete: true,
        isStreaming: false,
        thinkingStep: undefined,
      })
    } finally {
      setIsTyping(false)
    }
  }, [isTyping, addUserMessage, setIsTyping, addAIPlaceholder, updateLastAI])

  return { messages, isProcessing: isTyping, sendMessage }
}
