import { Notification } from 'electron'
import { dueReminders, markNotified } from './db'
import type { ToastPayload } from '../shared/types'

type Sender = (payload: ToastPayload) => void

let timer: NodeJS.Timeout | null = null
let sender: Sender | null = null
let opener: Sender | null = null

export function startNotifier(onToast: Sender, onOpen: Sender): void {
  sender = onToast
  opener = onOpen
  stopNotifier()
  timer = setInterval(check, 30_000)
  check()
}

export function stopNotifier(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function check(): void {
  try {
    const due = dueReminders()
    for (const t of due) {
      const payload: ToastPayload = {
        id: crypto.randomUUID(),
        title: '待办提醒',
        body: t.title,
        todoId: t.id
      }
      const n = new Notification({
        title: payload.title,
        body: payload.body ?? ''
      })
      n.on('click', () => {
        opener?.(payload)
      })
      n.show()
      sender?.(payload)
      markNotified(t.id)
    }
  } catch (err) {
    console.error('[notifier] check error:', err)
  }
}
