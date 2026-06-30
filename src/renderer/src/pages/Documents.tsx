import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { Button } from '@renderer/components/ui/Button'
import { Icon } from '@renderer/components/ui/Icon'
import { LogoMark } from '@renderer/components/ui/LogoMark'
import { WindowControls } from '@renderer/components/ui/WindowControls'
import type {
  DocumentExternalChange,
  ExternalChangeConflict,
  MarkdownDocument,
  MarkdownWorkspace,
  SaveState
} from '@shared/types'

interface OpenDocument {
  document: MarkdownDocument
  content: string
  savedContent: string
  saveState: SaveState
  error?: string
  revision: number
}

function MilkdownEditor({
  path,
  content,
  readOnly,
  onChange
}: {
  path: string
  content: string
  readOnly: boolean
  onChange: (markdown: string) => void
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
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.TopBar]: true
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
    void crepe.create()
    return () => {
      disposed = true
      void crepe.destroy()
    }
    // `content` is the mount-time document value; live changes flow through markdownUpdated.
    // Including it would destroy and recreate Crepe after every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly])

  return <div ref={rootRef} className="document-crepe h-full overflow-y-auto" />
}

function saveLabel(state: SaveState): string {
  if (state === 'saving') return '保存中…'
  if (state === 'saved') return '已保存'
  if (state === 'error') return '保存失败'
  if (state === 'conflict') return '外部修改冲突'
  return ''
}

export function DocumentsPage() {
  const [maximized, setMaximized] = useState(false)
  const [workspaces, setWorkspaces] = useState<MarkdownWorkspace[]>([])
  const [documents, setDocuments] = useState<MarkdownDocument[]>([])
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [conflict, setConflict] = useState<ExternalChangeConflict | null>(null)
  const [externalChange, setExternalChange] = useState<DocumentExternalChange | null>(null)
  const saveTimers = useRef(new Map<string, number>())
  const openDocumentsRef = useRef(openDocuments)
  openDocumentsRef.current = openDocuments

  const active = useMemo(
    () => openDocuments.find((item) => item.document.path === activePath) ?? null,
    [activePath, openDocuments]
  )

  const refreshLibrary = useCallback(async () => {
    const [nextWorkspaces, nextDocuments] = await Promise.all([
      window.api.documents.workspaces(),
      window.api.documents.list(selectedWorkspaceId)
    ])
    setWorkspaces(nextWorkspaces)
    setDocuments(nextDocuments)
    setSearchActive(false)
  }, [selectedWorkspaceId])

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
          revision: 0
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
    void refreshLibrary()
  }, [refreshLibrary])

  useEffect(() => {
    let offMaximize: (() => void) | undefined
    void window.api.window.isMaximized().then(setMaximized)
    offMaximize = window.api.window.onMaximizeChange(setMaximized)
    return () => offMaximize?.()
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
      void refreshLibrary()
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
  }, [openPath, refreshLibrary])

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

  const displayedDocuments = useMemo(() => {
    if (searchActive) return documents
    if (!query.trim()) return documents
    const needle = query.toLocaleLowerCase()
    return documents.filter(
      (document) =>
        document.name.toLocaleLowerCase().includes(needle) ||
        document.relativePath?.toLocaleLowerCase().includes(needle) ||
        document.tags.some((tag) => tag.name.toLocaleLowerCase().includes(needle))
    )
  }, [documents, query, searchActive])

  const performSearch = async () => {
    if (!query.trim()) {
      await refreshLibrary()
      return
    }
    const results = await window.api.documents.search(query)
    setDocuments(results.map((result) => result.document))
    setSearchActive(true)
  }

  const importDocuments = async () => {
    const imported = await window.api.documents.import()
    await refreshLibrary()
    if (imported[0]) await openPath(imported[0].path)
  }

  const addWorkspace = async () => {
    const workspace = await window.api.documents.addWorkspace()
    if (!workspace) return
    setSelectedWorkspaceId(workspace.id)
    await refreshLibrary()
  }

  const createDocument = async () => {
    const workspaceId = selectedWorkspaceId ?? workspaces[0]?.id
    if (!workspaceId) {
      window.alert('请先添加一个文件夹工作区')
      return
    }
    const document = await window.api.documents.create(workspaceId)
    await refreshLibrary()
    await openPath(document.path)
  }

  const rescanWorkspace = async () => {
    if (!selectedWorkspaceId) return
    setDocuments(await window.api.documents.scanWorkspace(selectedWorkspaceId))
    setSearchActive(false)
  }

  const removeWorkspace = async () => {
    if (!selectedWorkspaceId) return
    const workspace = workspaces.find((item) => item.id === selectedWorkspaceId)
    if (!window.confirm(`从文档库移除工作区“${workspace?.name ?? ''}”？磁盘文件不会删除。`)) return
    const workspaceTabs = openDocumentsRef.current.filter(
      (item) => item.document.workspaceId === selectedWorkspaceId
    )
    for (const item of workspaceTabs) {
      if (!(await savePath(item.document.path))) return
    }
    const removedPaths = new Set(workspaceTabs.map((item) => item.document.path))
    setOpenDocuments((items) => items.filter((item) => !removedPaths.has(item.document.path)))
    if (activePath && removedPaths.has(activePath)) setActivePath(null)
    await window.api.documents.removeWorkspace(selectedWorkspaceId)
    setSelectedWorkspaceId(undefined)
    await refreshLibrary()
  }

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

  const renameActive = async () => {
    if (!active) return
    const name = window.prompt('新文件名', active.document.name)
    if (!name || name === active.document.name) return
    if (!(await savePath(active.document.path))) return
    const document = await window.api.documents.rename(active.document.path, name)
    replacePath(active.document.path, document)
    await refreshLibrary()
  }

  const moveActive = async () => {
    if (!active || !(await savePath(active.document.path))) return
    const document = await window.api.documents.move(active.document.path)
    if (!document) return
    replacePath(active.document.path, document)
    await refreshLibrary()
  }

  const deleteActive = async () => {
    if (!active || !window.confirm(`将“${active.document.name}”移到回收站？`)) return
    await window.api.documents.delete(active.document.path)
    const path = active.document.path
    setOpenDocuments((items) => items.filter((item) => item.document.path !== path))
    setActivePath(null)
    await refreshLibrary()
  }

  const updateTags = async () => {
    if (!active) return
    const value = window.prompt('标签（用逗号分隔）', active.document.tags.map((tag) => tag.name).join(', '))
    if (value === null) return
    const tags = await window.api.documents.setTags(
      active.document.path,
      value.split(/[,，]/)
    )
    setOpenDocuments((items) =>
      items.map((item) =>
        item.document.path === active.document.path
          ? { ...item, document: { ...item.document, tags } }
          : item
      )
    )
    await refreshLibrary()
  }

  const reloadActive = async () => {
    if (!activePath) return
    const result = await window.api.documents.read(activePath)
    setOpenDocuments((items) =>
      items.map((item) =>
        item.document.path === activePath
          ? {
              document: result.document,
              content: result.content,
              savedContent: result.content,
              saveState: 'idle',
              revision: item.revision + 1
            }
          : item
      )
    )
    setConflict(null)
    setExternalChange(null)
  }

  const saveActiveAs = async () => {
    if (!active) return
    const document = await window.api.documents.saveAs(active.document.path, active.content)
    if (!document) return
    await refreshLibrary()
    await openPath(document.path)
    setConflict(null)
  }

  return (
    <div
      className={`absolute bg-pure-white overflow-hidden ${
        maximized
          ? 'inset-0'
          : 'inset-1 rounded-[14px] border border-black/10 shadow-[0_2px_12px_rgba(0,0,0,.16)]'
      }`}
    >
      <header className="document-titlebar h-14 flex items-center px-4 border-b border-dove/30 bg-pure-white select-none">
        <div className="flex items-center gap-2 document-no-drag">
          <LogoMark size={28} />
          <span className="serif text-[18px]">TodoMark 文档</span>
        </div>
        <div className="flex-1" />
        <div className="document-no-drag flex items-center gap-2">
          <Button size="sm" variant="link" onClick={addWorkspace}>打开文件夹</Button>
          <Button size="sm" variant="link" onClick={importDocuments}>导入</Button>
          <Button size="sm" onClick={createDocument}><Icon name="plus" size={14} />新建</Button>
        </div>
        <WindowControls />
      </header>

      <div className="absolute inset-x-0 bottom-0 flex" style={{ top: '56px' }}>
        <aside className="w-[286px] shrink-0 border-r border-dove/30 bg-fog flex flex-col">
          <div className="p-3 border-b border-dove/30">
            <div className="flex items-center gap-2 rounded-xl bg-pure-white border border-dove/40 px-3 py-2">
              <Icon name="search" size={14} className="text-graphite" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void performSearch()}
                placeholder="搜索标题、正文或标签"
                className="w-full bg-transparent text-[13px] outline-none"
              />
            </div>
          </div>
          <div className="px-3 pt-3">
            <button
              className={`document-workspace ${selectedWorkspaceId === undefined ? 'active' : ''}`}
              onClick={() => setSelectedWorkspaceId(undefined)}
            >
              <Icon name="clock" size={14} />最近文档
            </button>
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                className={`document-workspace ${selectedWorkspaceId === workspace.id ? 'active' : ''}`}
                onClick={() => setSelectedWorkspaceId(workspace.id)}
                title={workspace.rootPath}
              >
                <Icon name="layers" size={14} />
                <span className="truncate">{workspace.name}</span>
              </button>
            ))}
            {selectedWorkspaceId && (
              <div className="flex items-center gap-3 px-2 py-2 text-[11px]">
                <button className="text-graphite hover:text-ink" onClick={rescanWorkspace}>刷新索引</button>
                <button className="text-graphite hover:text-rust" onClick={removeWorkspace}>移除工作区</button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {displayedDocuments.map((document) => (
              <button
                key={document.path}
                className={`document-file ${activePath === document.path ? 'active' : ''}`}
                onClick={() => void openPath(document.path)}
                title={document.path}
              >
                <Icon name="note" size={15} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] text-ink">{document.name}</span>
                  <span className="block truncate text-[10px] text-graphite">
                    {document.relativePath ?? document.path}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-pure-white">
          <div className="h-11 shrink-0 flex items-end overflow-x-auto border-b border-dove/30 bg-fog px-2 pt-1">
            {openDocuments.map((item) => (
              <button
                key={item.document.path}
                className={`document-tab ${activePath === item.document.path ? 'active' : ''}`}
                onClick={() => setActivePath(item.document.path)}
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
              <div className="h-12 shrink-0 flex items-center gap-2 px-5 border-b border-dove/25">
                <span className={`text-[11px] ${active.saveState === 'error' || active.saveState === 'conflict' ? 'text-rust' : 'text-graphite'}`}>
                  {active.document.readOnly ? '只读' : saveLabel(active.saveState)}
                </span>
                {active.error && <span className="text-[11px] text-rust truncate">{active.error}</span>}
                <div className="flex-1" />
                {active.document.tags.map((tag) => (
                  <span key={tag.id} className="rounded-full bg-fog px-2 py-1 text-[10px] text-graphite">#{tag.name}</span>
                ))}
                <button className="document-action" onClick={updateTags}>标签</button>
                <button className="document-action" onClick={renameActive}>重命名</button>
                <button className="document-action" onClick={moveActive}>移动</button>
                <button className="document-action text-rust" onClick={deleteActive}>删除</button>
              </div>
              {(externalChange?.path === active.document.path || conflict?.path === active.document.path) && (
                <div className="flex items-center gap-3 bg-apricot-wash px-5 py-2 text-[12px] text-rust">
                  <span className="flex-1">
                    {externalChange?.deleted ? '文件已被外部删除。' : '文件已在其他程序中修改，继续保存可能覆盖外部内容。'}
                  </span>
                  {!externalChange?.deleted && <button onClick={reloadActive}>重新载入</button>}
                  <button onClick={saveActiveAs}>另存为</button>
                  {!externalChange?.deleted && <button onClick={() => void savePath(active.document.path, true)}>覆盖</button>}
                </div>
              )}
              <div className="flex-1 min-h-0 bg-pure-white">
                <MilkdownEditor
                  key={`${active.document.path}:${active.revision}`}
                  path={active.document.path}
                  content={active.content}
                  readOnly={active.document.readOnly}
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
                <p className="mt-2 text-[13px]">选择左侧文件，或打开文件夹工作区</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
