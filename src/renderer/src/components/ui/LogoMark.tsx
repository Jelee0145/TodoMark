import React from 'react'

interface Props {
  size?: number
  className?: string
}

export function LogoMark({ size = 32, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M18 12h23l9 9v31H18V12z"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <path
        d="M41 12v10h9"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <path
        d="M26 32h16M26 41h12"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
