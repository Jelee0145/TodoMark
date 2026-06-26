import React from 'react'

interface Props {
  label: string
  children: React.ReactNode
  side?: 'top' | 'bottom'
}

export function Tooltip({ label, children, side = 'top' }: Props) {
  return (
    <span className="t-tt inline-flex" tabIndex={0}>
      {children}
      <span
        className="t-tt-tip"
        style={side === 'bottom' ? { top: 'calc(100% + 8px)', bottom: 'auto' } : undefined}
      >
        {label}
      </span>
    </span>
  )
}
