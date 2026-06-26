import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTodosStore } from '@renderer/store/todos'
import { Button } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Icon } from '@renderer/components/ui/Icon'
import { Modal } from '@renderer/components/ui/Modal'
import { showSuccessCheck } from '@renderer/components/ui/SuccessCheck'
import { toDateIso } from '@renderer/lib/format'
import type { Todo } from '@shared/types'

export function TodosPage() {
  const { todos, showDone, load, toggleDone, create, update, remove, setShowDone } =
    useTodosStore()
  const [searchParams] = useSearchParams()
  const highlightedTodoId = searchParams.get('todoId')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<Todo>>({ title: '' })
  // 正在播放退场动画的待办 id
  const [leaving, setLeaving] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, number>>(new Map())
  const todoRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!highlightedTodoId) return
    const id = window.setTimeout(() => {
      todoRefs.current.get(highlightedTodoId)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      })
    }, 50)
    return () => window.clearTimeout(id)
  }, [highlightedTodoId, todos])

  // 组件卸载时清理所有退场计时器
  useEffect(() => {
    return () => {
      timers.current.forEach((id) => clearTimeout(id))
      timers.current.clear()
    }
  }, [])

  const handleToggle = (t: Todo) => {
    if (!t.done && !showDone) {
      // 未完成 → 完成，且不显示已完成：先播退场动画再真正标记
      setLeaving((prev) => new Set(prev).add(t.id))
      const id = window.setTimeout(() => {
        toggleDone(t)
        setLeaving((prev) => {
          const next = new Set(prev)
          next.delete(t.id)
          return next
        })
        timers.current.delete(t.id)
      }, 380)
      timers.current.set(t.id, id)
      showSuccessCheck('已完成')
    } else {
      // 显示已完成模式：就地切换（动画由 CSS data-done 控制）
      // 或从已完成取消：直接切
      toggleDone(t)
      if (!t.done) showSuccessCheck('已完成')
    }
  }

  const save = async () => {
    if (!draft.title?.trim()) return
    await create({ title: draft.title.trim(), remindAt: draft.remindAt ?? null })
    setDraft({ title: '' })
    setOpen(false)
  }

  const toInputValue = (ms: number | null | undefined) =>
    ms ? new Date(ms).toISOString().slice(0, 16) : ''

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="title-eyebrow mb-1.5">Todos · 待办</div>
            <h1 className="serif text-[40px] text-ink" style={{ letterSpacing: '-0.8px', lineHeight: 1.1 }}>
              待办提醒
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors ${
                showDone ? 'bg-fog text-ink' : 'text-graphite hover:bg-fog hover:text-ink'
              }`}
              onClick={() => setShowDone(!showDone)}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                  showDone ? 'bg-ink border-ink' : 'border-dove'
                }`}
              >
                {showDone && <Icon name="check" size={10} strokeWidth={2.5} className="text-pure-white" />}
              </span>
              显示已完成
            </button>
            <Button onClick={() => setOpen(true)}>
              <Icon name="plus" size={14} strokeWidth={1.8} />
              新建
            </Button>
          </div>
        </div>

        {todos.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Icon name="check" size={44} strokeWidth={1.3} className="text-dove" />}
              title="没有待办"
              desc="点击新建，到点会收到系统通知和应用内横幅"
              action={<Button onClick={() => setOpen(true)}>添加第一个待办</Button>}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-2.5">
            {todos.map((t, i) => {
              const overdue = t.remindAt !== null && t.remindAt < Date.now() && !t.done
              const isLeaving = leaving.has(t.id)
              const isHighlighted = highlightedTodoId === t.id
              return (
                <div
                  key={t.id}
                  ref={(node) => {
                    if (node) {
                      todoRefs.current.set(t.id, node)
                    } else {
                      todoRefs.current.delete(t.id)
                    }
                  }}
                  className={`t-todo t-stagger ${isLeaving ? 'is-leaving' : ''} ${
                    isHighlighted ? 'is-highlighted' : ''
                  }`}
                  data-done={t.done ? '1' : '0'}
                  style={{ ['--stagger-i' as string]: Math.min(i, 8) }}
                >
                  <Card
                    data-done={t.done ? '1' : '0'}
                    className="t-todo-card !p-4 flex items-start gap-3.5"
                  >
                    {/* 自定义复选框（带描边动画） */}
                    <button
                      className="t-check mt-0.5"
                      data-checked={t.done ? '1' : '0'}
                      onClick={() => handleToggle(t)}
                      aria-label={t.done ? '标记未完成' : '标记完成'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24">
                        <path className="t-check-path" d="M5 12.5l4 4 10-11" />
                      </svg>
                    </button>

                    <div className="t-todo-content flex-1 min-w-0">
                      <div
                        className={`text-[15px] font-medium ${
                          t.done ? 'line-through text-graphite' : 'text-ink'
                        }`}
                      >
                        {t.title}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[12px] text-ash">
                        {t.remindAt !== null && (
                          <span
                            className={`flex items-center gap-1 ${overdue ? 'text-rust' : ''}`}
                          >
                            <Icon name="clock" size={12} strokeWidth={1.7} />
                            {toDateIso(t.remindAt).slice(5)}{' '}
                            {new Date(t.remindAt).toTimeString().slice(0, 5)}
                          </span>
                        )}
                        {t.dueAt !== null && (
                          <span className="flex items-center gap-1">
                            <Icon name="calendar" size={12} strokeWidth={1.7} />
                            {toDateIso(t.dueAt).slice(5)}
                          </span>
                        )}
                        {t.done === 1 && showDone && (
                          <span className="text-dove">已完成</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                      <input
                        type="datetime-local"
                        value={toInputValue(t.remindAt)}
                        onChange={(e) =>
                          update(t.id, {
                            remindAt: e.target.value ? new Date(e.target.value).getTime() : null
                          })
                        }
                        className="text-[11px] rounded-2xl border border-dove/60 bg-fog px-2 py-1 text-graphite focus:outline-none focus:border-rust"
                      />
                      <button
                        className="w-7 h-7 grid place-items-center rounded-full text-graphite hover:text-rust hover:bg-apricot-wash/60 transition-colors"
                        onClick={() => remove(t.id)}
                        aria-label="删除"
                      >
                        <Icon name="trash" size={13} strokeWidth={1.7} />
                      </button>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 新建 Modal（t-modal 缩放动效） */}
      <Modal open={open} onClose={() => setOpen(false)} title="新建待办">
        <input
          className="w-full rounded-2xl border border-dove/60 bg-pure-white px-3.5 py-2.5 text-[15px] focus:outline-none focus:border-rust transition-colors"
          placeholder="待办内容"
          value={draft.title ?? ''}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          autoFocus
        />
        <div className="mt-3">
          <label className="text-[12px] text-graphite flex items-center gap-1">
            <Icon name="clock" size={12} strokeWidth={1.7} /> 提醒时间
          </label>
          <input
            type="datetime-local"
            className="w-full mt-1.5 rounded-2xl border border-dove/60 bg-pure-white px-3.5 py-2.5 text-[14px] focus:outline-none focus:border-rust transition-colors"
            value={toInputValue(draft.remindAt)}
            onChange={(e) =>
              setDraft({
                ...draft,
                remindAt: e.target.value ? new Date(e.target.value).getTime() : null
              })
            }
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="link" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={save}>保存</Button>
        </div>
      </Modal>
    </div>
  )
}
