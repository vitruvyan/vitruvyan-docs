'use client'

import { VoiceOrb } from '../chat/VoiceOrb'
import type { OrbState } from '../chat/VoiceOrb'
import styles from './VoiceOverlay.module.css'

interface Props {
  active: boolean
  state: OrbState
  level: number
  onClose: () => void
}

export function VoiceOverlay({ active, state, level, onClose }: Props) {
  if (!active) return null

  return (
    <div className={styles.overlay}>
      <VoiceOrb state={state} level={level} embedded />
      <button className={styles.closeBtn} onClick={onClose} aria-label="Stop voice session">
        ✕
      </button>
    </div>
  )
}
