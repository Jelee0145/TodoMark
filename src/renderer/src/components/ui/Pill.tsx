import React from 'react'

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  color?: string
}

export function Pill({ color = '#097fe8', className = '', children, style, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium ${className}`}
      style={{ background: `${color}1a`, color, ...style }}
      {...rest}
    >
      {children}
    </span>
  )
}
