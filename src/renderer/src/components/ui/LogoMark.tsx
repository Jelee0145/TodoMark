import React from 'react'

interface Props {
  size?: number
  className?: string
}

export function LogoMark({ size = 32, className = '' }: Props) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      className={className}
      alt="TodoMark"
      draggable={false}
    />
  )
}
