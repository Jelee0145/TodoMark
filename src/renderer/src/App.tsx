import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useMatch } from 'react-router-dom'
import { TopBar } from './components/ui/TopBar'
import { ToastHost } from './components/ui/Toast'
import { SuccessCheckHost } from './components/ui/SuccessCheck'
import { DashboardPage } from './pages/Dashboard'
import { NotesPage } from './pages/Notes'
import { TodosPage } from './pages/Todos'
import { SettingsPage } from './pages/Settings'
import { StickyNotePage } from './pages/StickyNote'
import { DocumentsPage } from './pages/Documents'
import { useUsageStore } from './store/usage'
import { todoReminderPath } from './lib/todo-route'

export default function App() {
  const navigate = useNavigate()
  const stickyMatch = useMatch('/sticky-note/:noteId')
  const documentsMatch = useMatch('/documents')
  const isStickyRoute = !!stickyMatch
  const isDocumentsRoute = !!documentsMatch
  const loadPaused = useUsageStore((s) => s.loadPaused)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (isStickyRoute || isDocumentsRoute) return
    loadPaused()
    let off: (() => void) | undefined
    ;(async () => {
      setMaximized(await window.api.window.isMaximized())
      off = window.api.window.onMaximizeChange((m) => setMaximized(m))
    })()
    return () => off?.()
  }, [isDocumentsRoute, isStickyRoute, loadPaused])

  useEffect(() => {
    if (isStickyRoute || isDocumentsRoute) return
    return window.api.onTodoReminderOpen((payload) => {
      if (payload.todoId) navigate(todoReminderPath(payload.todoId))
    })
  }, [isDocumentsRoute, isStickyRoute, navigate])

  useEffect(() => {
    if (isStickyRoute || isDocumentsRoute) return
    return window.api.onNoteOpen((payload) => {
      navigate(`/notes?noteId=${encodeURIComponent(payload.noteId)}`)
    })
  }, [isDocumentsRoute, isStickyRoute, navigate])

  if (isStickyRoute) {
    return (
      <Routes>
        <Route path="/sticky-note/:noteId" element={<StickyNotePage />} />
      </Routes>
    )
  }

  if (isDocumentsRoute) {
    return (
      <Routes>
        <Route path="/documents" element={<DocumentsPage />} />
      </Routes>
    )
  }

  return (
    <div
      className={`absolute bg-pure-white overflow-hidden transition-[inset,border-radius,box-shadow] duration-200 ease-out ${
        maximized
          ? 'inset-0'
          : 'inset-1 rounded-[14px] border border-[rgba(0,0,0,0.12)] shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.12)]'
      }`}
      style={{ '--app-window-inset': maximized ? '0px' : '4px' } as React.CSSProperties}
    >
      <TopBar />
      <main className="absolute left-0 right-0 bottom-0 overflow-hidden" style={{ top: 'var(--topbar-h)' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <ToastHost />
      <SuccessCheckHost />
    </div>
  )
}
