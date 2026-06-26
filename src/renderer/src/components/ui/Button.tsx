import React from 'react'

type Variant = 'primary' | 'link'
type Size = 'sm' | 'md'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-[background,color,transform] duration-150 active:scale-[0.98]'
  const sizes: Record<Size, string> = {
    sm: 'text-[13px] px-4 py-1.5',
    md: 'text-[15px] px-5 py-2'
  }
  const variants: Record<Variant, string> = {
    // DESIGN.md: 唯一深色填充药丸按钮（Ink 底白字，9999px）
    primary: 'bg-ink text-pure-white rounded-full hover:bg-obsidian',
    // DESIGN.md: 次要动作 = 文本链接（无底无边）
    link: 'bg-transparent text-ink rounded-full hover:bg-fog'
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}
