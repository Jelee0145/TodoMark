import React, { useEffect, useState } from 'react'

interface Props {
  value: string | number
  className?: string
}

// 数字逐位模糊滑入；value 变化时重新触发
export function NumberPopIn({ value, className = '' }: Props) {
  const digits = String(value).split('')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    setNonce((n) => n + 1)
  }, [value])

  return (
    <span className={`t-number ${className}`} key={nonce}>
      {digits.map((d, i) => (
        <span key={i} className="t-number-digit" style={{ ['--num-i' as string]: i }}>
          {d}
        </span>
      ))}
    </span>
  )
}
