'use client'

import { VoiceOrb } from '../chat/VoiceOrb'
import type { OrbState } from '../chat/VoiceOrb'
import styles from './VoiceOverlay.module.css'

interface Props {
  state: OrbState
  level: number
}

export function VoiceOverlay({ state, level }: Props) {
  if (state === 'idle') return null

  return (
    <div className={styles.overlay}>
      <VoiceOrb state={state} level={level} embedded />
    </div>
  )
}
