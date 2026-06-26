import React, { useEffect, useRef, useState } from 'react'

interface Props {
  count?: number
  height?: number
  className?: string
  children?: React.ReactNode
  loading: boolean
}

// 加载态：显示骨架行；加载完：交叉淡入真实内容
export function Skeleton({ count = 3, height = 16, className = '', children, loading }: Props) {
  const revealedRef = useRef(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!loading && !revealedRef.current) {
      revealedRef.current = true
      const raf = requestAnimationFrame(() => setRevealed(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [loading])

  if (loading) {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="t-skel" style={{ height }} />
        ))}
      </div>
    )
  }
  return <div className={`t-skel-reveal ${revealed ? 'is-revealed' : ''}`}>{children}</div>
}
