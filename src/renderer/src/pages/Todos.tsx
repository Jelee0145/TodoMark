import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTodosStore } from '@renderer/store/todos'
import { Button } from '@renderer/components/ui/Button'
import { Card } from '@renderer/components/ui/Card'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Icon } from '@renderer/components/ui/Icon'
import { showSuccessCheck } from '@renderer/components/ui/SuccessCheck'
import type { Todo, TodoGroup } from '@shared/types'

interface EditingValue {
  id: string
  value: string
}

interface NewChildValue {
  groupId: string
  value: string
  focusKey: number
}

export function TodosPage() {
  const {
    todos,
    groups,
    showDone,
    load,
    createGroup,
    updateGroup,
    toggleGroup,
    removeGroup,
    createTodo,
    updateTodo,
    toggleTodo,
    removeTodo,
    setShowDone
  } = useTodosStore()
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('todoId')
  const [newGroupTitle, setNewGroupTitle] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<EditingValue | null>(null)
  const [editingTodo, setEditingTodo] = useState<EditingValue | null>(null)
  const [newChild, setNewChild] = useState<NewChildValue | null>(null)
  const [childrenCollapsed, setChildrenCollapsed] = useState<Set<string>>(new Set())
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [openingGroups, setOpeningGroups] = useState<Set<string>>(new Set())
  const [closingGroups, setClosingGroups] = useState<Set<string>>(new Set())
  const [openingTodos, setOpeningTodos] = useState<Set<string>>(new Set())
  const [closingTodos, setClosingTodos] = useState<Set<string>>(new Set())
  const [completingGroups, setCompletingGroups] = useState<Set<string>>(new Set())
  const [newGroupVisible, setNewGroupVisible] = useState(false)
  const [newChildVisible, setNewChildVisible] = useState(false)
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const groupInputRef = useRef<HTMLInputElement>(null)
  const todoInputRef = useRef<HTMLInputElement>(null)
  const newChildInputRef = useRef<HTMLInputElement>(null)
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())
  const committing = useRef(new Set<string>())

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    if (newGroupTitle !== null) newGroupInputRef.current?.focus()
  }, [newGroupTitle])

  useEffect(() => {
    if (editingGroup) selectInput(groupInputRef.current)
  }, [editingGroup?.id])

  useEffect(() => {
    if (editingTodo) selectInput(todoInputRef.current)
  }, [editingTodo?.id])

  useEffect(() => {
    if (newChild) newChildInputRef.current?.focus()
  }, [newChild?.groupId, newChild?.focusKey])

  useEffect(() => {
    if (!highlightedId) return
    const timer = window.setTimeout(() => {
      cardRefs.current.get(highlightedId)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
    return () => window.clearTimeout(timer)
  }, [highlightedId, groups, todos])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-card-id]')) return
      setSelectedGroupId((current) => {
        if (!current) return current
        if (editingGroup?.id === current) setEditingGroup(null)
        if (newChild?.groupId === current) {
          setNewChildVisible(false)
          setNewChild(null)
        }
        return null
      })
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingGroup, newChild])

  const todosByGroup = useMemo(() => {
    const result = new Map<string, Todo[]>()
    for (const todo of todos) {
      if (!todo.groupId) continue
      const items = result.get(todo.groupId) ?? []
      items.push(todo)
      result.set(todo.groupId, items)
    }
    result.forEach((items) =>
      items.sort((left, right) => {
        if (left.done !== right.done) return left.done - right.done
        return left.sort - right.sort
      })
    )
    return result
  }, [todos])

  const runOnce = async (key: string, action: () => Promise<void>) => {
    if (committing.current.has(key)) return
    committing.current.add(key)
    try {
      await action()
    } finally {
      window.requestAnimationFrame(() => committing.current.delete(key))
    }
  }

  const commitNewGroup = async (addChild: boolean) => {
    const title = newGroupTitle?.trim() ?? ''
    if (!title) {
      if (!addChild) closeNewGroupDraft()
      return
    }
    await runOnce('new-group', async () => {
      const group = await createGroup(title)
      setNewGroupTitle(null)
      revealItem(group.id, setOpeningGroups)
      setSelectedGroupId(group.id)
      if (addChild) {
        beginNewChild(group.id)
      }
    })
  }

  const commitGroupTitle = async (group: TodoGroup, addChild: boolean) => {
    if (editingGroup?.id !== group.id) return
    const title = editingGroup.value.trim()
    if (!title) {
      setEditingGroup(null)
      return
    }
    await runOnce(`group:${group.id}`, async () => {
      if (title !== group.title) await updateGroup(group.id, { title })
      setEditingGroup(null)
      if (addChild) beginNewChild(group.id)
    })
  }

  const commitTodoTitle = async (todo: Todo, addNext: boolean) => {
    if (editingTodo?.id !== todo.id) return
    const title = editingTodo.value.trim()
    if (!title) {
      setEditingTodo(null)
      return
    }
    await runOnce(`todo:${todo.id}`, async () => {
      if (title !== todo.title) await updateTodo(todo.id, { title })
      setEditingTodo(null)
      if (addNext && todo.groupId) beginNewChild(todo.groupId)
    })
  }

  const commitNewChild = async (continueAdding: boolean) => {
    if (!newChild) return
    const snapshot = newChild
    const title = snapshot.value.trim()
    if (!title) {
      if (!continueAdding) closeNewChild()
      return
    }
    await runOnce(`new-child:${snapshot.groupId}`, async () => {
      const created = await createTodo(snapshot.groupId, title)
      revealItem(created.id, setOpeningTodos)
      if (continueAdding) {
        setNewChild({ groupId: snapshot.groupId, value: '', focusKey: Date.now() })
      } else {
        await closeNewChild()
      }
    })
  }

  const beginNewChild = (groupId: string) => {
    setSelectedGroupId(groupId)
    setNewChildVisible(false)
    setChildrenCollapsed((current) => without(current, groupId))
    setNewChild({ groupId, value: '', focusKey: Date.now() })
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setNewChildVisible(true))
    })
  }

  const openNewGroupDraft = () => {
    setNewGroupVisible(false)
    setNewGroupTitle('')
    setEditingGroup(null)
    setEditingTodo(null)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setNewGroupVisible(true))
    })
  }

  const closeNewGroupDraft = async () => {
    setNewGroupVisible(false)
    await waitForMotion('--panel-close-dur', 350)
    setNewGroupTitle(null)
  }

  const closeNewChild = async () => {
    setNewChildVisible(false)
    await waitForMotion('--panel-close-dur', 350)
    setNewChild(null)
  }

  const toggleChildrenCollapsed = (groupId: string) => {
    setChildrenCollapsed((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const confirmRemoveGroup = async (group: TodoGroup) => {
    if (window.confirm(`确定删除“${group.title}”及其全部子待办吗？`)) {
      setClosingGroups((current) => withValue(current, group.id))
      setSelectedGroupId((current) => (current === group.id ? null : current))
      await waitForMotion('--panel-close-dur', 350)
      await removeGroup(group.id)
      setClosingGroups((current) => without(current, group.id))
    }
  }

  const confirmRemoveTodo = async (todo: Todo) => {
    if (!window.confirm(`确定删除“${todo.title}”吗？`)) return
    setClosingTodos((current) => withValue(current, todo.id))
    await waitForMotion('--panel-close-dur', 350)
    await removeTodo(todo.id)
    setClosingTodos((current) => without(current, todo.id))
  }

  const handleToggleGroup = async (group: TodoGroup) => {
    if (completingGroups.has(group.id)) return

    if (group.done) {
      await toggleGroup(group)
      return
    }

    const items = todosByGroup.get(group.id) ?? []
    const remaining = items.filter((todo) => todo.done !== 1)
    setCompletingGroups((current) => withValue(current, group.id))
    try {
      for (let i = 0; i < remaining.length; i++) {
        const todo = remaining[i]
        if (i > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 120))
        await updateTodo(todo.id, { done: 1 })
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 200))
      await toggleGroup(group)
      showSuccessCheck('已完成')
      await new Promise<void>((resolve) => window.setTimeout(resolve, 200))
      if (!showDone) {
        setClosingGroups((current) => withValue(current, group.id))
        await waitForMotion('--panel-close-dur', 350)
      }
    } finally {
      setCompletingGroups((current) => without(current, group.id))
      setClosingGroups((current) => without(current, group.id))
    }
  }

  const handleToggleTodo = async (todo: Todo) => {
    try {
      await toggleTodo(todo)
      if (!todo.done) showSuccessCheck('已完成')
    } finally {
      setClosingTodos((current) => without(current, todo.id))
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[820px] mx-auto px-7 py-10">
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
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                  showDone ? 'bg-ink border-ink' : 'border-dove'
                }`}
              >
                {showDone && (
                  <Icon name="check-simple" size={10} strokeWidth={2.5} className="text-pure-white" />
                )}
              </span>
              显示已完成
            </button>
            <Button
              onClick={openNewGroupDraft}
            >
              <Icon name="plus" size={14} strokeWidth={1.8} />
              新建
            </Button>
          </div>
        </div>

        {groups.length === 0 && newGroupTitle === null ? (
          <Card>
            <EmptyState
              icon={<Icon name="check" size={44} strokeWidth={1.3} className="text-dove" />}
              title="没有待办"
              desc="点击新建后直接输入，按回车添加子待办"
              action={<Button onClick={openNewGroupDraft}>添加第一个待办</Button>}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {newGroupTitle !== null && (
              <section
                className="todo-inline-card is-editing t-panel-slide"
                data-open={newGroupVisible ? 'true' : 'false'}
              >
                <div className="todo-group-header">
                  <CheckButton checked={false} disabled label="待办尚未保存" />
                  <input
                    ref={newGroupInputRef}
                    className="todo-inline-title-input"
                    value={newGroupTitle}
                    placeholder="请输入标题"
                    onChange={(event) => setNewGroupTitle(event.target.value)}
                    onBlur={() => commitNewGroup(false)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitNewGroup(true)
                      } else if (event.key === 'Escape') {
                        closeNewGroupDraft()
                      }
                    }}
                  />
                </div>
                <div className="todo-inline-hint">输入标题后按回车添加子待办</div>
              </section>
            )}

            {groups
              .filter((group) => group.done === 0 || showDone)
              .map((group, index) => {
              const items = todosByGroup.get(group.id) ?? []
              const completed = items.filter((todo) => todo.done === 1).length
              const total = items.length || 1
              const progress = items.length ? completed : group.done ? 1 : 0
              const isChildrenCollapsed = childrenCollapsed.has(group.id)
              const isSelected = selectedGroupId === group.id
              const isCompleting = completingGroups.has(group.id)
              const highlighted = highlightedId === group.id
              return (
                <div
                  key={group.id}
                  className="t-stagger"
                  style={{ ['--stagger-i' as string]: Math.min(index, 10) }}
                >
                <div
                  className="todo-group-motion t-panel-slide"
                  data-open={
                    openingGroups.has(group.id) || closingGroups.has(group.id) ? 'false' : 'true'
                  }
                >
                <section
                  ref={(node) => {
                    if (node) cardRefs.current.set(group.id, node)
                    else cardRefs.current.delete(group.id)
                  }}
                  data-card-id={group.id}
                  data-children-open={isChildrenCollapsed ? 'false' : 'true'}
                  className={`todo-inline-card ${isSelected ? 'is-selected' : ''} ${
                    highlighted ? 'is-highlighted' : ''
                  } ${editingGroup?.id === group.id ? 'is-editing' : ''}`}
                  onClick={() => {
                    if (!isSelected) setSelectedGroupId(group.id)
                  }}
                >
                  <div className="todo-group-header">
                    <CheckButton
                      checked={group.done === 1}
                      disabled={isCompleting}
                      label={group.done ? '标记未完成' : '完成全部待办'}
                      onClick={() => handleToggleGroup(group)}
                    />
                    <div className="min-w-0 flex-1">
                      {editingGroup?.id === group.id ? (
                        <input
                          ref={groupInputRef}
                          className="todo-inline-title-input"
                          value={editingGroup.value}
                          onChange={(event) =>
                            setEditingGroup({ id: group.id, value: event.target.value })
                          }
                          onBlur={() => commitGroupTitle(group, false)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitGroupTitle(group, true)
                            } else if (event.key === 'Escape') {
                              setEditingGroup(null)
                            }
                          }}
                        />
                      ) : (
                        <button
                          className={`todo-inline-title ${group.done ? 'is-done' : ''}`}
                          onClick={() => setEditingGroup({ id: group.id, value: group.title })}
                        >
                          {group.title}
                        </button>
                      )}
                    </div>
                    <span className="text-[12px] text-dove tabular-nums">{progress} / {total}</span>
                    {items.length > 0 && (
                      <button
                        className="todo-collapse-button"
                        onClick={() => toggleChildrenCollapsed(group.id)}
                        aria-label={isChildrenCollapsed ? '展开子待办' : '收起子待办'}
                      >
                        <span className="t-acc-chevron">
                          <Icon name="chevron-down" size={14} />
                        </span>
                      </button>
                    )}
                    <button
                      className="todo-delete-button"
                      onClick={() => confirmRemoveGroup(group)}
                      aria-label="删除待办"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>

                  <div
                    className="t-acc-panel"
                    data-open={isChildrenCollapsed ? 'false' : 'true'}
                  >
                    <div className="t-acc-panel-inner">
                      <div className="todo-children">
                        {items.map((todo) => (
                          <div
                            key={todo.id}
                            ref={(node) => {
                              if (node) cardRefs.current.set(todo.id, node)
                              else cardRefs.current.delete(todo.id)
                            }}
                            className="todo-child-row group t-panel-slide"
                            data-open={
                              openingTodos.has(todo.id) || closingTodos.has(todo.id) ? 'false' : 'true'
                            }
                          >
                            <CheckButton
                              checked={todo.done === 1}
                              label={todo.done ? '标记未完成' : '标记完成'}
                              onClick={() => handleToggleTodo(todo)}
                            />
                            {editingTodo?.id === todo.id ? (
                              <input
                                ref={todoInputRef}
                                className="todo-child-input"
                                value={editingTodo.value}
                                onChange={(event) =>
                                  setEditingTodo({ id: todo.id, value: event.target.value })
                                }
                                onBlur={() => commitTodoTitle(todo, false)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    commitTodoTitle(todo, true)
                                  } else if (event.key === 'Escape') {
                                    setEditingTodo(null)
                                  }
                                }}
                              />
                            ) : (
                              <button
                                className={`todo-child-title ${todo.done ? 'is-done' : ''}`}
                                onClick={() => setEditingTodo({ id: todo.id, value: todo.title })}
                              >
                                {todo.title}
                              </button>
                            )}
                            <button
                              className="todo-child-delete"
                              onClick={() => confirmRemoveTodo(todo)}
                              aria-label="删除子待办"
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    className="t-acc-panel"
                    data-open={isSelected ? 'true' : 'false'}
                  >
                    <div className="t-acc-panel-inner todo-feature-panel-inner">
                      {newChild?.groupId !== group.id && (
                        <button
                          className="todo-add-child"
                          onClick={() => beginNewChild(group.id)}
                        >
                          <span className="todo-add-child-slot">
                            <Icon name="plus" size={14} strokeWidth={1.8} />
                          </span>
                          <span>添加子待办</span>
                        </button>
                      )}

                      {newChild?.groupId === group.id && (
                        <div
                          className="todo-child-row t-panel-slide"
                          data-open={newChildVisible ? 'true' : 'false'}
                        >
                          <CheckButton checked={false} disabled label="子待办尚未保存" />
                          <input
                            ref={newChildInputRef}
                            className="todo-child-input"
                            value={newChild.value}
                            placeholder="输入子待办"
                            onChange={(event) =>
                              setNewChild({ ...newChild, value: event.target.value })
                            }
                            onBlur={() => commitNewChild(false)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                commitNewChild(true)
                              } else if (event.key === 'Escape') {
                                closeNewChild()
                              }
                            }}
                          />
                        </div>
                      )}

                      <label className="todo-reminder-row">
                        <Icon name="clock" size={15} strokeWidth={1.7} />
                        <span>{group.remindAt ? '提醒时间' : '设置提醒'}</span>
                        <input
                          type="datetime-local"
                          value={toLocalDateTime(group.remindAt)}
                          onChange={(event) =>
                            updateGroup(group.id, {
                              remindAt: event.target.value
                                ? new Date(event.target.value).getTime()
                                : null
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                </section>
                </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckButton({
  checked,
  label,
  disabled = false,
  onClick
}: {
  checked: boolean
  label: string
  disabled?: boolean
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      className="t-check shrink-0"
      data-checked={checked ? '1' : '0'}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path className="t-check-path" d="M5 12.5l4 4 10-11" />
      </svg>
    </button>
  )
}

function selectInput(input: HTMLInputElement | null): void {
  if (!input) return
  input.focus()
  input.select()
}

function without(values: Set<string>, value: string): Set<string> {
  const next = new Set(values)
  next.delete(value)
  return next
}

function withValue(values: Set<string>, value: string): Set<string> {
  const next = new Set(values)
  next.add(value)
  return next
}

function revealItem(
  id: string,
  setItems: React.Dispatch<React.SetStateAction<Set<string>>>
): void {
  setItems((current) => withValue(current, id))
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      setItems((current) => without(current, id))
    })
  })
}

async function waitForMotion(variable: string, fallbackMs: number): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  const parsed = Number.parseFloat(raw)
  const duration = Number.isFinite(parsed) ? parsed * (raw.endsWith('ms') ? 1 : 1000) : fallbackMs
  await new Promise<void>((resolve) => window.setTimeout(resolve, duration))
}

function toLocalDateTime(ms: number | null): string {
  if (!ms) return ''
  const date = new Date(ms)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
