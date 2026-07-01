import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { Button } from '@renderer/components/ui/Button'
import { Icon } from '@renderer/components/ui/Icon'
import { LogoMark } from '@renderer/components/ui/LogoMark'
import { Modal } from '@renderer/components/ui/Modal'
import { WindowControls } from '@renderer/components/ui/WindowControls'
import { NotesToolbar } from '@renderer/components/notes/NotesToolbar'
import type {
  DocumentExternalChange,
  ExternalChangeConflict,
  MarkdownDocument,
  SaveState
} from '@shared/types'

interface OpenDocument {
  document: MarkdownDocument
  content: string
  savedContent: string
  saveState: SaveState
  error?: string
  revision: number
  editMode: boolean
}

function MilkdownEditor({
  path,
  content,
  readOnly,
  onChange,
  crepeRef
}: {
  path: string
  content: string
  readOnly: boolean
  onChange: (markdown: string) => void
  crepeRef: React.MutableRefObject<Crepe | null>
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!rootRef.current) return
    let disposed = false
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: content,
      features: {
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.Latex]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.TopBar]: false
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: '开始写作…' },
        [Crepe.Feature.ImageBlock]: {
          proxyDomURL: (source) => window.api.documents.resolveAsset(path, source)
        }
      }
    })
    crepe.setReadonly(readOnly)
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
        if (!disposed && markdown !== previousMarkdown) onChangeRef.current(markdown)
      })
    })
    void crepe.create().then(() => {
      if (!disposed) crepeRef.current = crepe
    })
    return () => {
      disposed = true
      crepeRef.current = null
      void crepe.destroy()
    }
    // `content` is the mount-time document value; live changes flow through markdownUpdated.
    // Including it would destroy and recreate Crepe after every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly])

  return (
    <div
      ref={rootRef}
      className="document-crepe h-full overflow-y-auto"
    />
  )
}

function saveLabel(state: SaveState): string {
  if (state === 'saving') return '保存中…'
  if (state === 'saved') return '已保存'
  if (state === 'error') return '保存失败'
  if (state === 'conflict') return '外部修改冲突'
  return ''
}

function PromptDialog({
  open,
  title,
  label,
  defaultValue,
  placeholder,
  confirmText = '确定',
  onClose,
  onConfirm
}: {
  open: boolean
  title: string
  label: string
  defaultValue: string
  placeholder?: string
  confirmText?: string
  onClose: () => void
  onConfirm: (value: string) => void
}) {
  const [value, setValue] = useState(defaultValue)
  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="link" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => onConfirm(value)}>{confirmText}</Button>
        </>
      }
    >
      <label className="block text-[12px] text-graphite mb-1.5">{label}</label>
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onConfirm(value)
        }}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-dove/60 bg-pure-white px-3.5 py-2 text-[14px] focus:outline-none focus:border-rust transition-colors"
      />
    </Modal>
  )
}

export function DocumentsPage() {
  const [maximized, setMaximized] = useState(false)
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ExternalChangeConflict | null>(null)
  const [externalChange, setExternalChange] = useState<DocumentExternalChange | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const saveTimers = useRef(new Map<string, number>())
  const crepeRef = useRef<Crepe | null>(null)
  const openDocumentsRef = useRef(openDocuments)
  openDocumentsRef.current = openDocuments

  const active = useMemo(
    () => openDocuments.find((item) => item.document.path === activePath) ?? null,
    [activePath, openDocuments]
  )

  const openPath = useCallback(async (path: string) => {
    const existing = openDocumentsRef.current.find((item) => item.document.path === path)
    if (existing) {
      setActivePath(path)
      return
    }
    try {
      const result = await window.api.documents.read(path)
      setOpenDocuments((items) => [
        ...items,
        {
          document: result.document,
          content: result.content,
          savedContent: result.content,
          saveState: 'idle',
          revision: 0,
          editMode: false
        }
      ])
      setActivePath(result.document.path)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '无法打开文档')
    }
  }, [])

  const savePath = useCallback(async (path: string, force = false) => {
    const item = openDocumentsRef.current.find((candidate) => candidate.document.path === path)
    if (!item || item.content === item.savedContent || item.document.readOnly) return true
    setOpenDocuments((items) =>
      items.map((candidate) =>
        candidate.document.path === path ? { ...candidate, saveState: 'saving', error: undefined } : candidate
      )
    )
    try {
      const contentToSave = item.content
      const result = await window.api.documents.save(
        path,
        contentToSave,
        item.document.mtimeMs,
        force
      )
      if (!result.ok) {
        setConflict(result.conflict)
        setOpenDocuments((items) =>
          items.map((candidate) =>
            candidate.document.path === path ? { ...candidate, saveState: 'conflict' } : candidate
          )
        )
        return false
      }
      setConflict(null)
      setExternalChange(null)
      setOpenDocuments((items) =>
        items.map((candidate) =>
          candidate.document.path === path
            ? {
                ...candidate,
                document: result.document,
                savedContent: contentToSave,
                saveState: 'saved'
              }
            : candidate
        )
      )
      return true
    } catch (error) {
      setOpenDocuments((items) =>
        items.map((candidate) =>
          candidate.document.path === path
            ? {
                ...candidate,
                saveState: 'error',
                error: error instanceof Error ? error.message : '保存失败'
              }
            : candidate
        )
      )
      return false
    }
  }, [])

  const scheduleSave = useCallback(
    (path: string) => {
      const old = saveTimers.current.get(path)
      if (old) window.clearTimeout(old)
      const timer = window.setTimeout(() => {
        saveTimers.current.delete(path)
        void savePath(path)
      }, 600)
      saveTimers.current.set(path, timer)
    },
    [savePath]
  )

  useEffect(() => {
    return window.api.documents.onFlushRequested(() => {
      void (async () => {
        for (const item of openDocumentsRef.current) {
          const timer = saveTimers.current.get(item.document.path)
          if (timer) window.clearTimeout(timer)
          if (!(await savePath(item.document.path))) {
            window.alert('仍有文档未能保存，请处理保存错误或外部修改冲突后再关闭窗口。')
            return
          }
        }
        await window.api.documents.confirmClose()
      })()
    })
  }, [savePath])

  useEffect(() => {
    void window.api.window.isMaximized().then(setMaximized)
    return window.api.window.onMaximizeChange(setMaximized)
  }, [])

  useEffect(() => {
    let mounted = true
    void window.api.documents.getSession().then(async (session) => {
      for (const path of session.openPaths) {
        if (!mounted) return
        await openPath(path)
      }
      if (mounted && session.activePath) setActivePath(session.activePath)
    })
    const offOpen = window.api.documents.onOpenPaths((paths) => {
      for (const path of paths) void openPath(path)
    })
    const offExternal = window.api.documents.onExternalChange((payload) => {
      if (openDocumentsRef.current.some((item) => item.document.path === payload.path)) {
        setExternalChange(payload)
      }
    })
    return () => {
      mounted = false
      offOpen()
      offExternal()
    }
  }, [openPath])

  useEffect(() => {
    void window.api.documents.setSession({
      openPaths: openDocuments.map((item) => item.document.path),
      activePath
    })
  }, [activePath, openDocuments])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 's') {
        event.preventDefault()
        if (activePath) void savePath(activePath)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activePath, savePath])

  const closeTab = async (path: string) => {
    const timer = saveTimers.current.get(path)
    if (timer) window.clearTimeout(timer)
    const saved = await savePath(path)
    if (!saved) return
    setOpenDocuments((items) => items.filter((item) => item.document.path !== path))
    if (activePath === path) {
      const remaining = openDocumentsRef.current.filter((item) => item.document.path !== path)
      setActivePath(remaining.at(-1)?.document.path ?? null)
    }
  }

  const replacePath = (oldPath: string, document: MarkdownDocument) => {
    setOpenDocuments((items) =>
      items.map((item) =>
        item.document.path === oldPath ? { ...item, document, saveState: 'saved' } : item
      )
    )
    if (activePath === oldPath) setActivePath(document.path)
  }

  const submitRename = async (newName: string) => {
    if (!active) return
    const trimmed = newName.trim()
    if (!trimmed || trimmed === active.document.name) {
      setRenameOpen(false)
      return
    }
    if (!(await savePath(active.document.path))) return
    try {
      const document = await window.api.documents.rename(active.document.path, trimmed)
      replacePath(active.document.path, document)
      setRenameOpen(false)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '重命名失败')
    }
  }

  const submitTags = async (raw: string) => {
    if (!active) return
    try {
      const tags = await window.api.documents.setTags(
        active.document.path,
        raw.split(/[,，]/)
      )
      setOpenDocuments((items) =>
        items.map((item) =>
          item.document.path === active.document.path
            ? { ...item, document: { ...item.document, tags } }
            : item
        )
      )
      setTagsOpen(false)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '设置标签失败')
    }
  }

  const moveActive = async () => {
    if (!active || !(await savePath(active.document.path))) return
    try {
      const document = await window.api.documents.move(active.document.path)
      if (!document) return
      replacePath(active.document.path, document)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '移动失败')
    }
  }

  const deleteActive = async () => {
    if (!active || !window.confirm(`将"${active.document.name}"移到回收站？`)) return
    try {
      await window.api.documents.delete(active.document.path)
      const path = active.document.path
      setOpenDocuments((items) => items.filter((item) => item.document.path !== path))
      setActivePath(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '删除失败')
    }
  }

  const reloadActive = async () => {
    if (!activePath) return
    try {
      const result = await window.api.documents.read(activePath)
      setOpenDocuments((items) =>
        items.map((item) =>
          item.document.path === activePath
            ? {
                document: result.document,
                content: result.content,
                savedContent: result.content,
                saveState: 'idle',
                revision: item.revision + 1,
                editMode: false
              }
            : item
        )
      )
      setConflict(null)
      setExternalChange(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '重新载入失败')
    }
  }

  const saveActiveAs = async () => {
    if (!active) return
    try {
      const document = await window.api.documents.saveAs(active.document.path, active.content)
      if (!document) return
      await openPath(document.path)
      setConflict(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '另存为失败')
    }
  }

  return (
    <div
      className={`absolute bg-pure-white overflow-hidden ${
        maximized
          ? 'inset-0'
          : 'inset-1 rounded-[14px] border border-black/10 shadow-[0_2px_12px_rgba(0,0,0,.16)]'
      }`}
    >
      <header className="document-titlebar h-16 flex items-center px-6 border-b border-dove/30 bg-pure-white select-none">
        <div className="flex items-center gap-2.5 document-no-drag">
          <LogoMark size={30} />
          <span className="serif text-[20px] text-ink" style={{ letterSpacing: '-0.4px' }}>
            TodoMark 文档
          </span>
        </div>
        <div className="flex-1" />
        <WindowControls />
      </header>

      <div className="absolute inset-x-0 bottom-0 flex flex-col" style={{ top: '64px' }}>
        <div className="h-11 shrink-0 flex items-end overflow-x-auto border-b border-dove/30 bg-fog/60 px-2 pt-1">
          {openDocuments.map((item) => (
            <button
              key={item.document.path}
              className={`document-tab ${activePath === item.document.path ? 'active' : ''}`}
              onClick={() => setActivePath(item.document.path)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  void closeTab(item.document.path)
                }
              }}
              title={item.document.path}
            >
              <span className="truncate">{item.document.name}</span>
              {item.content !== item.savedContent && <span className="text-rust">●</span>}
              <span
                className="document-tab-close"
                onClick={(event) => {
                  event.stopPropagation()
                  void closeTab(item.document.path)
                }}
              >
                <Icon name="close" size={12} />
              </span>
            </button>
          ))}
        </div>

        {active ? (
          <>
            <div className="documents-action-row shrink-0 flex items-center border-b border-dove/25 bg-pure-white">
              <NotesToolbar crepeRef={crepeRef} readOnly={active.document.readOnly} />
              <div className="flex-1 min-w-0 flex items-center gap-2.5 px-3 h-14">
                <span className={`shrink-0 text-[11px] ${active.saveState === 'error' || active.saveState === 'conflict' ? 'text-rust' : 'text-graphite'}`}>
                  {active.document.readOnly ? '只读' : saveLabel(active.saveState)}
                </span>
                {active.error && (
                  <span className="shrink-0 text-[11px] text-rust truncate max-w-[200px]" title={active.error}>
                    {active.error}
                  </span>
                )}
                {active.document.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    {active.document.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="rounded-full bg-fog px-2.5 py-0.5 text-[10px] text-graphite whitespace-nowrap"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex-1" />
                <Button size="sm" variant="link" onClick={() => setTagsOpen(true)}>
                  <Icon name="pin" size={12} strokeWidth={1.7} />标签
                </Button>
                <Button size="sm" variant="link" onClick={() => setRenameOpen(true)}>
                  <Icon name="edit" size={12} strokeWidth={1.7} />重命名
                </Button>
                <Button size="sm" variant="link" onClick={moveActive}>
                  <Icon name="layers" size={12} strokeWidth={1.7} />移动
                </Button>
                {!active.document.readOnly && (
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => {
                      setOpenDocuments((items) =>
                        items.map((item) =>
                          item.document.path === active.document.path
                            ? { ...item, editMode: !item.editMode }
                            : item
                        )
                      )
                    }}
                    title={active.editMode ? '切换为只读' : '开始编辑'}
                  >
                    <Icon
                      name={active.editMode ? 'check' : 'edit'}
                      size={12}
                      strokeWidth={1.7}
                    />
                    {active.editMode ? '完成' : '编辑'}
                  </Button>
                )}
                <Button size="sm" variant="link" onClick={deleteActive} className="text-rust">
                  <Icon name="trash" size={12} strokeWidth={1.7} />删除
                </Button>
              </div>
            </div>
            {(externalChange?.path === active.document.path || conflict?.path === active.document.path) && (
              <div className="flex items-center gap-3 bg-apricot-wash px-6 py-2 text-[12px] text-rust">
                <span className="flex-1">
                  {externalChange?.deleted
                    ? '文件已被外部删除。'
                    : '文件已在其他程序中修改，继续保存可能覆盖外部内容。'}
                </span>
                {!externalChange?.deleted && (
                  <Button size="sm" variant="link" onClick={reloadActive}>
                    重新载入
                  </Button>
                )}
                <Button size="sm" variant="link" onClick={saveActiveAs}>
                  另存为
                </Button>
                {!externalChange?.deleted && (
                  <Button size="sm" onClick={() => void savePath(active.document.path, true)}>
                    覆盖
                  </Button>
                )}
              </div>
            )}
            <div className="flex-1 min-h-0 bg-pure-white">
              <MilkdownEditor
                key={`${active.document.path}:${active.revision}:${active.editMode ? 1 : 0}`}
                path={active.document.path}
                content={active.content}
                readOnly={active.document.readOnly || !active.editMode}
                crepeRef={crepeRef}
                onChange={(content) => {
                  setOpenDocuments((items) =>
                    items.map((item) =>
                      item.document.path === active.document.path
                        ? { ...item, content, saveState: 'idle' }
                        : item
                    )
                  )
                  scheduleSave(active.document.path)
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-center text-graphite">
            <div>
              <Icon name="note" size={48} className="mx-auto mb-4 text-dove" />
              <div className="serif text-[24px] text-ink">打开一篇 Markdown 文档</div>
              <p className="mt-2 text-[13px]">回到主窗口的"文档"页面选择文件</p>
            </div>
          </div>
        )}
      </div>

      <PromptDialog
        open={renameOpen}
        title="重命名"
        label="新文件名"
        defaultValue={active?.document.name ?? ''}
        placeholder="例如：会议记录.md"
        onClose={() => setRenameOpen(false)}
        onConfirm={submitRename}
      />
      <PromptDialog
        open={tagsOpen}
        title="标签"
        label="用逗号分隔多个标签"
        defaultValue={active?.document.tags.map((tag) => tag.name).join(', ') ?? ''}
        placeholder="日记, 项目, 灵感"
        confirmText="保存"
        onClose={() => setTagsOpen(false)}
        onConfirm={submitTags}
      />
    </div>
  )
}
