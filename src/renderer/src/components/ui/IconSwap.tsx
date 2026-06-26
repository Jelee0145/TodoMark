import React from 'react'

interface Props {
  active: 0 | 1 // 当前显示哪个图标
  icons: [React.ReactNode, React.ReactNode]
  size?: number
  className?: string
}

// 两图标交叉淡入（icon swap），active 决定显示哪个
export function IconSwap({ active, icons, className = '' }: Props) {
  return (
    <span className={`t-icon-swap ${className}`}>
      <span data-active={active === 0 ? 'true' : 'false'}>{icons[0]}</span>
      <span data-active={active === 1 ? 'true' : 'false'}>{icons[1]}</span>
    </span>
  )
}
