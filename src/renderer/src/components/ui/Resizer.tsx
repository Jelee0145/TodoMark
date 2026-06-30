import React, { useRef } from 'react'

interface Props {
  onResize: (deltaX: number) => void
  onResizeEnd?: () => void
}

// 拖拽分隔条：贴 Steep 规范，默认 1px Dove 细线，hover 出现把手，拖拽中 Rust
export function Resizer({ onResize, onResizeEnd }: Props) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true
    lastX.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    onResize(e.clientX - lastX.current)
    lastX.current = e.clientX
  }
  const onUp = (_e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    onResizeEnd?.()
  }

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      className="relative w-px cursor-col-resize shrink-0 bg-dove/30 group flex items-center justify-center"
      role="separator"
      aria-orientation="vertical"
    >
      {/* 默认细线 */}
      <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
      {/* hover 把手 */}
      <div className="absolute w-1 h-9 rounded-full bg-transparent group-hover:bg-ink/15 group-active:bg-rust transition-colors" />
    </div>
  )
}
