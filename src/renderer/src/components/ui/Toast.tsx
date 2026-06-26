import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ipc } from '../../lib/ipc'
import { todoReminderPath } from '../../lib/todo-route'
import type { ToastPayload } from '@shared/types'

interface ToastItem extends ToastPayload {
  phase: 'shown' | 'hiding'
}

export function ToastHost() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const off = ipc.onToast((payload) => {
      const item: ToastItem = { ...payload, phase: 'shown' }
      setItems((cur) => [...cur, item])
      window.setTimeout(() => {
        setItems((cur) => cur.map((it) => (it.id === payload.id ? { ...it, phase: 'hiding' } : it)))
      }, 4500)
      window.setTimeout(() => {
        setItems((cur) => cur.filter((it) => it.id !== payload.id))
      }, 4900)
    })
    return off
  }, [])

  if (items.length === 0) return null

  const openTodo = (item: ToastItem) => {
    if (!item.todoId) return
    navigate(todoReminderPath(item.todoId))
    setItems((cur) => cur.filter((it) => it.id !== item.id))
  }

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2">
      {items.map((it) => (
        <div
          key={it.id}
          role={it.todoId ? 'button' : undefined}
          tabIndex={it.todoId ? 0 : undefined}
          onClick={() => openTodo(it)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openTodo(it)
            }
          }}
          className={`t-toast bg-midnight-ink text-pure-white rounded-xl px-4 py-3 shadow-[var(--shadow-subtle)] min-w-[260px] max-w-[360px] ${
            it.phase === 'shown' ? 'is-shown' : 'is-hiding'
          } ${it.todoId ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-cool-blue/70' : ''}`}
        >
          <div className="text-[13px] font-semibold opacity-80">{it.title}</div>
          {it.body && <div className="text-[15px] mt-0.5 font-medium">{it.body}</div>}
        </div>
      ))}
    </div>
  )
}
