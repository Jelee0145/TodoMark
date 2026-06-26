import React, { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, children, footer }: Props) {
  const [closing, setClosing] = React.useState(false)
  const [render, setRender] = React.useState(open)

  useEffect(() => {
    if (open) {
      setRender(true)
      setClosing(false)
    } else if (render) {
      setClosing(true)
      const t = setTimeout(() => {
        setClosing(false)
        setRender(false)
      }, 150)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!render) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [render, onClose])

  if (!render) return null

  return (
    <div
      className={`t-modal-backdrop ${open && !closing ? 'is-open' : ''} ${closing ? 'is-closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="t-modal" role="dialog" aria-modal="true">
        {title && (
          <h3 className="text-[20px] font-semibold text-onyx mb-3" style={{ letterSpacing: '-0.4px' }}>
            {title}
          </h3>
        )}
        <div>{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
