import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MDEditor from '@uiw/react-md-editor'
import { useSearchParams } from 'react-router-dom'
import { useNotesStore } from '@renderer/store/notes'
import { Button } from '@renderer/components/ui/Button'
import { Pill } from '@renderer/components/ui/Pill'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Icon } from '@renderer/components/ui/Icon'
import { Resizer } from '@renderer/components/ui/Resizer'
import { ipc } from '@renderer/lib/ipc'
import { toDateIso } from '@renderer/lib/format'

const STORAGE_KEY = 'notes.panelWidths'
const DEFAULT_W = { sidebar: 220, list: 320 }
const MIN = { sidebar: 160, list: 220 }
const MAX = { sidebar: 360, list: 560 }

function loadWidths(): { sidebar: number; list: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        sidebar: Math.min(MAX.sidebar, Math.max(MIN.sidebar, p.sidebar ?? DEFAULT_W.sidebar)),
        list: Math.min(MAX.list, Math.max(MIN.list, p.list ?? DEFAULT_W.list))
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_W
}

export function NotesPage() {
  const [searchParams] = useSearchParams()
  const routeNoteId = searchParams.get('noteId')
  const {
    groups,
    notes,
    selectedGroupId,
    activeNoteId,
    loading,
    loadGroups,
    loadNotes,
    selectGroup,
    selectNote,
    createGroup,
    deleteGroup,
    createNote,
    updateNote,
    deleteNote
  } = useNotesStore()

  const [widths, setWidths] = useState(loadWidths)
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  useEffect(() => {
    loadGroups()
    loadNotes()
  }, [loadGroups, loadNotes])

  useEffect(() => {
    if (!routeNoteId) return
    selectGroup(undefined)
    selectNote(routeNoteId)
  }, [routeNoteId, selectGroup, selectNote])

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widthsRef.current))
    } catch {
      /* ignore */
    }
  }

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  )

  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState('#5d2a1a')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!openMenu) {
      setMenuPos(null)
      return
    }
    const close = () => {
      setOpenMenu(null)
      setMenuPos(null)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [openMenu])

  const openMenuAt = (key: string, anchor: HTMLElement) => {
    const r = anchor.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: r.right - 112 })
    setOpenMenu((v) => (v === key ? null : key))
  }

  // 编辑器本地受控态：镜像当前笔记的 title/content，输入即时反映、防抖落库
  // IME 兼容：不在 onChange 里做异步回填或门控，受控 value 与浏览器 IME 协同（React 17+ 已处理）；
  // 中文输入问题的真因是旧 store 的 loadNotes→骨架重建链路，现已用乐观更新切断，无需 composition 门控。
  const [titleDraft, setTitleDraft] = useState('')
  const [contentDraft, setContentDraft] = useState('')
  const debounceRef = useRef<Record<string, number>>({})

  // MD 编辑器全屏兜底：监听 fullscreen class 变化，强制 inline style 覆盖库默认的 top:0/z-index:99999
  // inline style + setProperty('!important') 是最高优先级，确保不盖住 TopBar
  const editorWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const wrap = editorWrapRef.current
    if (!wrap) return
    const fixFullscreen = () => {
      const el = wrap.querySelector('.w-md-editor')
      if (!el) return
      const isFs = (el as HTMLElement).classList.contains('w-md-editor-fullscreen')
      const h = getComputedStyle(document.documentElement).getPropertyValue('--topbar-h').trim() || '64px'
      const s = (el as HTMLElement).style
      if (isFs) {
        s.setProperty('position', 'fixed', 'important')
        s.setProperty('top', `calc(var(--app-window-inset, 0px) + ${h})`, 'important')
        s.setProperty('left', 'var(--app-window-inset, 0px)', 'important')
        s.setProperty('right', 'var(--app-window-inset, 0px)', 'important')
        s.setProperty('bottom', 'var(--app-window-inset, 0px)', 'important')
        s.setProperty('width', 'auto', 'important')
        s.setProperty('height', 'auto', 'important')
        s.setProperty('z-index', '60', 'important')
        s.setProperty('background', '#ffffff', 'important')
      } else {
        ;['position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'z-index', 'background'].forEach(
          (prop) => s.removeProperty(prop)
        )
      }
    }
    const mo = new MutationObserver(fixFullscreen)
    mo.observe(wrap, { attributes: true, attributeFilter: ['class'], subtree: true })
    fixFullscreen()
    return () => mo.disconnect()
  }, [activeNote?.id])

  const commitField = (id: string, field: 'title' | 'content', value: string) => {
    if (debounceRef.current[field]) window.clearTimeout(debounceRef.current[field]!)
    debounceRef.current[field] = window.setTimeout(() => {
      updateNote(id, { [field]: value })
      delete debounceRef.current[field]
    }, 400)
  }

  const openStickyNote = async () => {
    if (!activeNote) return
    Object.values(debounceRef.current).forEach((t) => t && window.clearTimeout(t))
    debounceRef.current = {}

    const patch: { title?: string; content?: string } = {}
    if (titleDraft !== activeNote.title) patch.title = titleDraft
    if (contentDraft !== activeNote.content) patch.content = contentDraft
    if (Object.keys(patch).length > 0) {
      await updateNote(activeNote.id, patch)
    }

    await ipc.stickyNotes.open(activeNote.id)
  }

  const handleDeleteNote = async (id: string) => {
    const note = notes.find((item) => item.id === id)
    if (!window.confirm(`确定删除“${note?.title || '无标题'}”吗？此操作无法撤销。`)) return
    if (id === activeNoteId) {
      Object.values(debounceRef.current).forEach((timer) => timer && window.clearTimeout(timer))
      debounceRef.current = {}
    }
    setOpenMenu(null)
    await deleteNote(id)
  }

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!window.confirm(`确定删除分组“${name}”吗？分组内的笔记会移到未分组。`)) return
    setOpenMenu(null)
    await deleteGroup(id)
  }

  // 切换激活笔记时：冲刷上一条未落库输入，并同步 draft 到新笔记
  useEffect(() => {
    Object.values(debounceRef.current).forEach((t) => t && window.clearTimeout(t))
    debounceRef.current = {}
    setTitleDraft(activeNote?.title ?? '')
    setContentDraft(activeNote?.content ?? '')
  }, [activeNote?.id])

  return (
    <div className="h-full flex overflow-hidden">
      {/* ===== 左：分组 ===== */}
      <aside
        className="bg-fog flex flex-col shrink-0"
        style={{ width: widths.sidebar }}
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <span className="title-eyebrow">分组</span>
          <button
            className="w-7 h-7 grid place-items-center rounded-full text-graphite hover:text-ink hover:bg-dove/20 transition-colors"
            onClick={() => setNewGroupOpen((v) => !v)}
            aria-label="新建分组"
          >
            <Icon name="plus" size={15} strokeWidth={1.8} />
          </button>
        </div>

        {newGroupOpen && (
          <div className="px-4 pb-3 flex flex-col gap-2">
            <input
              className="rounded-2xl border border-dove/60 bg-pure-white px-3 py-1.5 text-[13px] focus:outline-none focus:border-rust transition-colors"
              placeholder="分组名"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer bg-transparent border-0"
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (newGroupName.trim()) {
                    await createGroup(newGroupName.trim(), newGroupColor)
                    setNewGroupName('')
                    setNewGroupOpen(false)
                  }
                }}
              >
                创建
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pt-0.5 pb-4 space-y-0.5">
          <GroupItem
            active={selectedGroupId === undefined}
            onClick={() => selectGroup(undefined)}
            icon={<Icon name="layers" size={15} strokeWidth={1.6} className="opacity-70" />}
            label="全部笔记"
            count={notes.length}
          />
          {groups.map((g) => (
            <GroupItem
              key={g.id}
              active={selectedGroupId === g.id}
              onClick={() => selectGroup(g.id)}
              icon={<span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />}
              label={g.name}
              menuOpen={openMenu === `group:${g.id}`}
              onMenuToggle={(anchor) => openMenuAt(`group:${g.id}`, anchor)}
              onDelete={() => handleDeleteGroup(g.id, g.name)}
              menuPos={openMenu === `group:${g.id}` ? menuPos : null}
            />
          ))}
        </div>
      </aside>

      <Resizer
        onResize={(dx) =>
          setWidths((w) => ({
            ...w,
            sidebar: Math.min(MAX.sidebar, Math.max(MIN.sidebar, w.sidebar + dx))
          }))
        }
        onResizeEnd={persist}
      />

      {/* ===== 中：笔记列表 ===== */}
      <aside className="bg-pure-white flex flex-col shrink-0" style={{ width: widths.list }}>
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="title-eyebrow">笔记</span>
            <span className="text-[15px] font-medium text-ink mt-0.5">
              {selectedGroupId === undefined
                ? '全部'
                : groups.find((g) => g.id === selectedGroupId)?.name ?? '分组'}
              <span className="text-graphite ml-1.5 font-normal">{notes.length}</span>
            </span>
          </div>
          <Button size="sm" onClick={createNote}>
            <Icon name="plus" size={14} strokeWidth={1.8} />
            新建
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pt-0.5 pb-4">
          {loading ? (
            <div className="px-3 flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="t-skel h-[78px]" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <EmptyState title="还没有笔记" desc="点击右上角新建开始记录" />
          ) : (
            notes.map((n, idx) => {
              const grp = groups.find((g) => g.id === n.groupId)
              const active = activeNoteId === n.id
              const preview = n.content.replace(/[#*`>\-[\]()!]/g, '').replace(/\s+/g, ' ').trim()
              return (
                <div
                  key={n.id}
                  className="t-stagger relative group"
                  style={{
                    ['--stagger-i' as string]: Math.min(idx, 10),
                    ['--note-group-color' as string]: grp?.color ?? '#17191c'
                  }}
                >
                <button
                  className={`note-card relative w-full text-left rounded-2xl px-4 py-3 mb-1 group ${
                    active ? 'bg-fog' : 'hover:bg-fog/60'
                  }`}
                  onClick={() => selectNote(n.id)}
                >
                  <div className="flex items-center gap-1.5 pr-7">
                    {n.pinned === 1 && (
                      <Icon name="pin" size={11} strokeWidth={1.8} className="text-rust shrink-0" />
                    )}
                    <span
                      className={`text-[14px] truncate flex-1 ${n.pinned ? 'font-medium' : ''} ${
                        active ? 'text-ink' : 'text-ink/90'
                      }`}
                    >
                      {n.title || '无标题'}
                    </span>
                  </div>
                  <div className="text-[12px] text-graphite mt-1 line-clamp-2 leading-relaxed">
                    {preview.slice(0, 90) || '空笔记'}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {grp && (
                      <Pill color={grp.color} className="!text-[10px] !px-1.5 !py-0">
                        {grp.name}
                      </Pill>
                    )}
                    <span className="text-[10px] text-dove ml-auto tabular-nums">
                      {formatRel(n.updatedAt)}
                    </span>
                  </div>
                </button>
                <button
                  className="absolute right-3 top-3 z-10 w-7 h-7 grid place-items-center rounded-full text-graphite opacity-70 hover:opacity-100 hover:text-ink hover:bg-pure-white transition-colors"
                  onClick={(event) => {
                    event.stopPropagation()
                    openMenuAt(`note:${n.id}`, event.currentTarget)
                  }}
                  aria-label={`打开"${n.title || '无标题'}"的更多操作`}
                  aria-expanded={openMenu === `note:${n.id}`}
                >
                  <Icon name="more-horizontal" size={17} />
                </button>
                {openMenu === `note:${n.id}` && menuPos &&
                  createPortal(
                    <div
                      className="fixed z-[100] min-w-28 rounded-xl border border-dove/30 bg-pure-white p-1 shadow-[var(--shadow-card)]"
                      style={{ top: menuPos.top, left: menuPos.left }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-ink hover:bg-fog"
                        onClick={async () => {
                          setOpenMenu(null)
                          await updateNote(n.id, { pinned: n.pinned ? 0 : 1 })
                        }}
                      >
                        <Icon name="pin" size={13} />
                        {n.pinned ? '取消置顶' : '置顶'}
                      </button>
                      <button
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-rust hover:bg-apricot-wash/60"
                        onClick={() => handleDeleteNote(n.id)}
                      >
                        <Icon name="trash" size={13} />
                        删除
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              )
            })
          )}
        </div>
      </aside>

      <Resizer
        onResize={(dx) =>
          setWidths((w) => ({
            ...w,
            list: Math.min(MAX.list, Math.max(MIN.list, w.list + dx))
          }))
        }
        onResizeEnd={persist}
      />

      {/* ===== 右：编辑器 ===== */}
      <section ref={editorWrapRef} className="bg-pure-white flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {activeNote ? (
          <>
            <div className="px-7 pt-6 pb-4 border-b border-dove/30">
              <input
                className="w-full serif text-[26px] text-ink bg-transparent focus:outline-none placeholder:text-dove"
                style={{ letterSpacing: '-0.4px' }}
                value={titleDraft}
                placeholder="无标题"
                onChange={(e) => {
                  setTitleDraft(e.target.value)
                  commitField(activeNote.id, 'title', e.target.value)
                }}
              />
              <div className="flex items-center gap-2 mt-3">
                <select
                  className="rounded-full px-3 py-1 text-[12px] font-medium text-ink bg-fog border-0 focus:outline-none cursor-pointer"
                  value={activeNote.groupId ?? ''}
                  onChange={(e) => updateNote(activeNote.id, { groupId: e.target.value || null })}
                >
                  <option value="">未分组</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                    activeNote.pinned ? 'bg-apricot-wash text-rust' : 'text-graphite hover:bg-fog hover:text-ink'
                  }`}
                  onClick={() => updateNote(activeNote.id, { pinned: activeNote.pinned ? 0 : 1 })}
                >
                  <Icon name="pin" size={12} strokeWidth={1.8} />
                  {activeNote.pinned ? '已置顶' : '置顶'}
                </button>
                <div className="flex-1" />
                <span className="text-[11px] text-dove tabular-nums">
                  {toDateIso(activeNote.updatedAt)}
                </span>
                <button
                  className="w-8 h-8 grid place-items-center rounded-full text-graphite hover:text-cool-blue hover:bg-sky-wash/70 transition-colors"
                  onClick={openStickyNote}
                  aria-label="钉到屏幕"
                  title="钉到屏幕"
                >
                  <Icon name="pin" size={15} strokeWidth={1.7} />
                </button>
                <button
                  className="w-8 h-8 grid place-items-center rounded-full text-graphite hover:text-rust hover:bg-apricot-wash/60 transition-colors"
                  onClick={() => handleDeleteNote(activeNote.id)}
                  aria-label="删除"
                >
                  <Icon name="trash" size={15} strokeWidth={1.7} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden relative" data-color-mode="light">
              <MDEditor
                key={activeNote.id}
                value={contentDraft}
                height="100%"
                visibleDragbar={false}
                style={{ height: '100%' }}
                onChange={(val) => {
                  const v = val ?? ''
                  setContentDraft(v)
                  commitField(activeNote.id, 'content', v)
                }}
                preview="live"
                hideToolbar={false}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Icon name="note" size={44} strokeWidth={1.3} className="text-dove" />}
            title="选择或新建一条笔记"
            desc="左侧选择已有笔记，或在中间栏点击新建"
            action={
              <Button onClick={createNote}>
                <Icon name="plus" size={14} strokeWidth={1.8} />
                新建笔记
              </Button>
            }
          />
        )}
      </section>
    </div>
  )
}

// 分组项
function GroupItem({
  active,
  onClick,
  icon,
  label,
  count,
  menuOpen,
  onMenuToggle,
  onDelete,
  menuPos
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count?: number
  menuOpen?: boolean
  onMenuToggle?: (anchor: HTMLElement) => void
  onDelete?: () => void
  menuPos?: { top: number; left: number } | null
}) {
  return (
    <div className="relative group">
      <button
      className={`w-full text-left rounded-full px-3 py-2 flex items-center gap-2.5 text-[14px] transition-colors ${
        active ? 'bg-pure-white text-ink font-medium shadow-[var(--shadow-subtle)]' : 'text-ash hover:bg-dove/15 hover:text-ink'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className={`flex-1 truncate ${onMenuToggle ? 'pr-7' : ''}`}>{label}</span>
      {count !== undefined && (
        <span className={`text-[11px] tabular-nums ${active ? 'text-graphite' : 'text-dove'}`}>{count}</span>
      )}
      </button>
      {onMenuToggle && (
        <button
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-graphite opacity-70 hover:opacity-100 hover:text-ink hover:bg-fog transition-colors"
          onClick={(event) => {
            event.stopPropagation()
            onMenuToggle(event.currentTarget)
          }}
          aria-label={`打开"${label}"的更多操作`}
          aria-expanded={menuOpen}
        >
          <Icon name="more-horizontal" size={16} />
        </button>
      )}
      {menuOpen && onDelete && menuPos &&
        createPortal(
          <div
            className="fixed z-[100] min-w-28 rounded-xl border border-dove/30 bg-pure-white p-1 shadow-[var(--shadow-card)]"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-rust hover:bg-apricot-wash/60"
              onClick={onDelete}
            >
              <Icon name="trash" size={13} />
              删除分组
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}

// 相对时间："3m" / "1h" / "2d" / "6/26"
function formatRel(ms: number): string {
  const diff = Date.now() - ms
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}天前`
  return toDateIso(ms).slice(5)
}
