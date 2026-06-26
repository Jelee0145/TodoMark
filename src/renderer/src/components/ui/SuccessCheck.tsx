import React, { useEffect, useState } from 'react'

interface Payload {
  message: string
  key: number
}

// 全局单例触发器
let emitter: ((p: Payload) => void) | null = null
export function showSuccessCheck(message: string): void {
  emitter?.({ message, key: Date.now() })
}

export function SuccessCheckHost() {
  const [item, setItem] = useState<Payload | null>(null)
  const [phase, setPhase] = useState<'shown' | 'hiding'>('shown')

  useEffect(() => {
    emitter = (p) => {
      setItem(p)
      setPhase('shown')
    }
    return () => {
      emitter = null
    }
  }, [])

  useEffect(() => {
    if (!item) return
    const t1 = setTimeout(() => setPhase('hiding'), 1400)
    const t2 = setTimeout(() => setItem(null), 1800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [item])

  if (!item) return null

  return (
    <div
      key={item.key}
      className={`t-success-check ${phase === 'shown' ? 'is-shown' : 'is-hiding'}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 12.5l3 3 5-6" stroke="currentColor" />
      </svg>
      {item.message}
    </div>
  )
}
