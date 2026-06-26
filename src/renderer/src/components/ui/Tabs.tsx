import React, { useEffect, useRef, useState } from 'react'

export interface TabItem {
  key: string
  label: string
}

interface Props {
  items: TabItem[]
  value: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className = '' }: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState({ x: 0, w: 0 })
  const [ready, setReady] = useState(false)

  const updatePill = (instant = false) => {
    const list = listRef.current
    if (!list) return
    const el = list.querySelector<HTMLElement>(`[data-key="${CSS.escape(value)}"]`)
    if (!el) return
    if (instant) {
      const prev = el.style.transition
      el.style.transition = 'none'
      setPill({ x: el.offsetLeft, w: el.offsetWidth })
      void list.offsetWidth
      requestAnimationFrame(() => {
        if (list) list.style.transition = ''
      })
      void prev
    } else {
      setPill({ x: el.offsetLeft, w: el.offsetWidth })
    }
  }

  useEffect(() => {
    updatePill(!ready)
    if (!ready) setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    const onResize = () => updatePill(true)
    window.addEventListener('resize', onResize)
    updatePill(true)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`t-tabs ${className}`}>
      <div className="t-tabs-list" ref={listRef}>
        <span
          className="t-tabs-pill"
          style={{
            transform: `translateX(${pill.x}px)`,
            width: pill.w,
            opacity: ready ? 1 : 0
          }}
        />
        {items.map((it) => (
          <button
            key={it.key}
            data-key={it.key}
            className="t-tab"
            aria-selected={value === it.key}
            onClick={() => onChange(it.key)}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}
