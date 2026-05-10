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
    <div className={styles.overlay} onClick={onClose}>
      {/* stop propagation so clicking the orb area doesn't close */}
      <div onClick={e => e.stopPropagation()}>
        <VoiceOrb state={state} level={level} embedded />
      </div>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Stop voice session">
        ✕
      </button>
      <p className={styles.closeTip}>Tap anywhere to close</p>
    </div>
  )
}
