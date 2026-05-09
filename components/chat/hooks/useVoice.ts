'use client'

import { useState, useRef, useCallback } from 'react'

export function useVoice(onTranscript: (text: string) => void, onAudioLevel: (level: number) => void) {
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const trackLevel = useCallback((analyser: AnalyserNode) => {
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      onAudioLevel(avg / 255)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [onAudioLevel])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser
      audioCtxRef.current = ctx
      trackLevel(analyser)

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current)
        onAudioLevel(0)
        stream.getTracks().forEach(t => t.stop())
        ctx.close()

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

        try {
          const res = await fetch('/api/kb-stt', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: blob,
          })
          const data = await res.json()
          if (data.text) onTranscript(data.text)
        } catch {
          // STT failed silently
        }
      }
      mediaRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch {
      // Microphone permission denied
    }
  }, [trackLevel, onTranscript, onAudioLevel])

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop()
    setIsRecording(false)
  }, [])

  const speakText = useCallback(async (text: string, onLevel: (l: number) => void) => {
    try {
      const res = await fetch('/api/kb-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      const ctx = new AudioContext()
      const src = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyser.connect(ctx.destination)

      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(buf)
        onLevel(buf.reduce((a, b) => a + b, 0) / buf.length / 255)
        if (!audio.paused) animFrameRef.current = requestAnimationFrame(tick)
        else { onLevel(0); ctx.close() }
      }

      setIsSpeaking(true)
      audio.onended = () => { setIsSpeaking(false); onLevel(0); ctx.close() }
      audio.play()
      tick()
    } catch {
      // TTS failed silently
    }
  }, [])

  return { isRecording, isSpeaking, startRecording, stopRecording, speakText }
}
