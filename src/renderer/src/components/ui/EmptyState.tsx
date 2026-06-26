import React from 'react'

interface Props {
  icon?: React.ReactNode
  title: string
  desc?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, desc, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="text-stone mb-4">{icon}</div>}
      <div className="text-[17px] font-semibold text-graphite">{title}</div>
      {desc && <div className="text-[14px] text-warm-gray mt-1.5 max-w-[320px]">{desc}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
