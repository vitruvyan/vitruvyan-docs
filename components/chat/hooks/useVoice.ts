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
  // Persistent AudioContext — created on mic click (user gesture) and reused
  // for TTS so browser autoplay policy is satisfied even after async delays.
  const ttsCtxRef = useRef<AudioContext | null>(null)

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

      // Create (or resume) the persistent TTS AudioContext on this user gesture
      if (!ttsCtxRef.current || ttsCtxRef.current.state === 'closed') {
        ttsCtxRef.current = new AudioContext()
      } else if (ttsCtxRef.current.state === 'suspended') {
        await ttsCtxRef.current.resume()
      }

      // Separate context for mic analysis (will be closed after recording)
      const micCtx = new AudioContext()
      const src = micCtx.createMediaStreamSource(stream)
      const analyser = micCtx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser
      trackLevel(analyser)

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current)
        onAudioLevel(0)
        stream.getTracks().forEach(t => t.stop())
        micCtx.close()
        setIsRecording(false)

        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size < 1000) return

        try {
          const res = await fetch('/api/kb-stt', {
            method: 'POST',
            headers: { 'Content-Type': mimeType },
            body: blob,
          })
          const data = await res.json()
          if (data.text?.trim()) onTranscript(data.text.trim())
        } catch {
          // STT failed silently
        }
      }
      mediaRef.current = recorder
      recorder.start()
      setIsRecording(true)

      // VAD: auto-stop after 1.5s silence following first speech
      let speechDetected = false
      let silenceStart = 0
      const SILENCE_MS = 1500
      const SPEECH_THRESHOLD = 0.04
      const silenceBuf = new Uint8Array(analyser.frequencyBinCount)
      const vadTick = () => {
        if (!mediaRef.current || mediaRef.current.state !== 'recording') return
        analyser.getByteFrequencyData(silenceBuf)
        const level = silenceBuf.reduce((a, b) => a + b, 0) / silenceBuf.length / 255
        if (level > SPEECH_THRESHOLD) {
          speechDetected = true
          silenceStart = 0
        } else if (speechDetected) {
          if (silenceStart === 0) silenceStart = Date.now()
          if (Date.now() - silenceStart > SILENCE_MS) {
            recorder.stop()
            return
          }
        }
        requestAnimationFrame(vadTick)
      }
      requestAnimationFrame(vadTick)

    } catch {
      // Microphone permission denied
    }
  }, [trackLevel, onTranscript, onAudioLevel])

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop()
    setIsRecording(false)
  }, [])

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    cancelAnimationFrame(animFrameRef.current)
    setIsSpeaking(false)
    onAudioLevel(0)
  }, [onAudioLevel])

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

      // Reuse the persistent AudioContext unlocked during mic click
      const ctx = ttsCtxRef.current ?? new AudioContext()
      if (ctx.state === 'suspended') await ctx.resume()

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
        else { onLevel(0) }
      }

      setIsSpeaking(true)
      audio.onended = () => { setIsSpeaking(false); onLevel(0) }
      await audio.play()
      tick()
    } catch {
      // TTS failed silently
    }
  }, [])

  return { isRecording, isSpeaking, startRecording, stopRecording, stopSpeaking, speakText }
}
