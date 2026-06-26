import React from 'react'

type Tone = 'white' | 'warm' | 'cool' | 'fog'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone
}

const TONE_CLASS: Record<Tone, string> = {
  white: 'card',
  warm: 'card-warm',
  cool: 'card-cool',
  fog: 'card-fog'
}

export function Card({ tone = 'white', className = '', children, ...rest }: Props) {
  return (
    <div className={`${TONE_CLASS[tone]} ${className}`} {...rest}>
      {children}
    </div>
  )
}
