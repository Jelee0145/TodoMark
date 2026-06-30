import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Icon } from '@renderer/components/ui/Icon'
import type { MarkdownDocument, MarkdownWorkspace } from '@shared/types'

const PREVIEW_LIMIT = 10
const RECENT_FETCH_LIMIT = 1000
const RECENT_SECTION_KEY = '__recent__'

type ExpandedState = Record<string, boolean>

interface DocumentGroup {
  key: string
  title: string
  hint?: string
  documents: MarkdownDocument[]
  removable: boolean
}

export function DocumentLibraryPage() {
  const [workspaces, setWorkspaces] = useState<MarkdownWorkspace[]>([])
  const [recent, setRecent] = useState<MarkdownDocument[]>([])
  const [documentsByWorkspace, setDocumentsByWorkspace] = useState<Record<string, MarkdownDocument[]>>(
    {}
  )
  const [expanded, setExpanded] = useState<ExpandedState>({ [RECENT_SECTION_KEY]: true })
  const [query, setQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [searchResults, setSearchResults] = useState<MarkdownDocument[]>([])

  const refresh = useCallback(async () => {
    const [nextWorkspaces, nextRecent] = await Promise.all([
      window.api.documents.workspaces(),
      window.api.documents.recent(RECENT_FETCH_LIMIT)
    ])
    setWorkspaces(nextWorkspaces)
    setRecent(nextRecent)
    setSearchActive(false)
    setSearchResults([])
    const byWorkspace: Record<string, MarkdownDocument[]> = {}
    await Promise.all(
      nextWorkspaces.map(async (workspace) => {
        byWorkspace[workspace.id] = await window.api.documents.list(workspace.id)
      })
    )
    setDocumentsByWorkspace(byWorkspace)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const openInReader = (document: MarkdownDocument) => {
    void window.api.documents.openWindow([document.path])
  }

  const addWorkspace = async () => {
    const workspace = await window.api.documents.addWorkspace()
    if (!workspace) return
    await refresh()
  }

  const removeWorkspace = async (workspace: MarkdownWorkspace) => {
    if (!window.confirm(`从文档库移除工作区"${workspace.name}"？磁盘文件不会删除。`)) return
    await window.api.documents.removeWorkspace(workspace.id)
    await refresh()
  }

  const createDocument = async (workspaceId: string) => {
    const document = await window.api.documents.create(workspaceId)
    await refresh()
    openInReader(document)
  }

  const importDocuments = async () => {
    const imported = await window.api.documents.import()
    await refresh()
    if (imported[0]) openInReader(imported[0])
  }

  const rescanWorkspace = async (workspaceId: string) => {
    const next = await window.api.documents.scanWorkspace(workspaceId)
    setDocumentsByWorkspace((prev) => ({ ...prev, [workspaceId]: next }))
    setSearchActive(false)
  }

  const forgetRecent = async (path: string) => {
    await window.api.documents.forget(path)
    setRecent((items) => items.filter((item) => item.path !== path))
  }

  const performSearch = async () => {
    const needle = query.trim()
    if (!needle) {
      await refresh()
      return
    }
    const results = await window.api.documents.search(needle)
    setSearchResults(results.map((result) => result.document))
    setSearchActive(true)
  }

  const clearSearch = async () => {
    setQuery('')
    await refresh()
  }

  const groups: DocumentGroup[] = useMemo(() => {
    const recentGroup: DocumentGroup = {
      key: RECENT_SECTION_KEY,
      title: '最近文档',
      documents: recent,
      removable: true
    }
    const workspaceGroups: DocumentGroup[] = workspaces.map((workspace) => ({
      key: workspace.id,
      title: workspace.name,
      hint: workspace.rootPath,
      documents: documentsByWorkspace[workspace.id] ?? [],
      removable: false
    }))
    return [recentGroup, ...workspaceGroups]
  }, [recent, workspaces, documentsByWorkspace])

  return (
    <div className="absolute inset-0 flex flex-col bg-pure-white">
      <div className="h-14 shrink-0 flex items-center gap-2 px-5 border-b border-dove/30 bg-pure-white">
        <div className="flex items-center gap-2.5 flex-1 rounded-xl bg-fog border border-dove/40 px-3 py-2">
          <Icon name="search" size={14} className="text-graphite" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void performSearch()}
            placeholder="搜索标题、正文或标签"
            className="w-full bg-transparent text-[13px] outline-none"
          />
          {searchActive && (
            <button
              onClick={() => void clearSearch()}
              className="text-[11px] text-graphite hover:text-ink"
            >
              清除
            </button>
          )}
        </div>
        <Button size="sm" variant="link" onClick={addWorkspace}>打开文件夹</Button>
        <Button size="sm" variant="link" onClick={importDocuments}>导入</Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {searchActive ? (
          <DocumentList
            title="搜索结果"
            documents={searchResults}
            removable={false}
            onOpen={openInReader}
          />
        ) : (
          groups.map((group) => {
            const isExpanded = !!expanded[group.key]
            const showCollapseControls = group.documents.length > PREVIEW_LIMIT
            const slice = isExpanded ? group.documents : group.documents.slice(0, PREVIEW_LIMIT)
            return (
              <section key={group.key} className="border-b border-dove/20">
                <header
                  className="h-11 flex items-center gap-2 px-5 cursor-pointer select-none hover:bg-fog transition-colors"
                  onClick={() => toggleSection(group.key)}
                >
                  <Icon
                    name={isExpanded ? 'chevron-down' : 'chevron-right'}
                    size={14}
                    className="text-graphite"
                  />
                  <span className="text-[13px] font-medium text-ink">{group.title}</span>
                  <span className="text-[11px] text-graphite">{group.documents.length}</span>
                  <div className="flex-1" />
                  {!group.removable && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        void rescanWorkspace(group.key)
                      }}
                      className="text-[11px] text-graphite hover:text-ink"
                    >
                      刷新索引
                    </button>
                  )}
                  {!group.removable && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        const workspace = workspaces.find((item) => item.id === group.key)
                        if (workspace) void removeWorkspace(workspace)
                      }}
                      className="text-[11px] text-graphite hover:text-rust"
                    >
                      移除工作区
                    </button>
                  )}
                </header>
                {isExpanded && (
                  <div className="pb-2">
                    {slice.length === 0 ? (
                      <div className="px-5 py-3 text-[12px] text-graphite">
                        {group.removable ? '还没有最近打开的文档' : '工作区里还没有 Markdown 文档'}
                      </div>
                    ) : (
                      <ul>
                        {slice.map((document) => (
                          <li
                            key={document.path}
                            className="group flex items-center gap-3 px-5 py-2 hover:bg-fog transition-colors"
                          >
                            <button
                              onClick={() => openInReader(document)}
                              className="flex items-center gap-3 min-w-0 flex-1 text-left"
                              title={document.path}
                            >
                              <Icon name="note" size={15} className="text-graphite shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] text-ink">
                                  {document.name}
                                </span>
                                <span className="block truncate text-[11px] text-graphite">
                                  {document.relativePath ?? document.path}
                                </span>
                              </span>
                              {document.tags.length > 0 && (
                                <span className="hidden md:inline text-[10px] text-graphite">
                                  #{document.tags.map((tag) => tag.name).join(' #')}
                                </span>
                              )}
                            </button>
                            {group.removable && (
                              <button
                                onClick={() => void forgetRecent(document.path)}
                                title="从最近文档中移除"
                                className="shrink-0 w-6 h-6 grid place-items-center rounded-full text-graphite opacity-0 group-hover:opacity-100 hover:text-rust hover:bg-pure-white transition-opacity"
                              >
                                <Icon name="close" size={12} />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {showCollapseControls && (
                      <div className="flex items-center justify-center py-2">
                        <button
                          onClick={() => toggleSection(group.key)}
                          className="text-[11px] text-graphite hover:text-ink"
                        >
                          {isExpanded ? '收起' : `展开更多（共 ${group.documents.length} 条）`}
                        </button>
                      </div>
                    )}
                    {!group.removable && group.key in documentsByWorkspace && (
                      <div className="flex items-center justify-center pb-2">
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => {
                            const workspace = workspaces.find((item) => item.id === group.key)
                            if (workspace) void createDocument(workspace.id)
                          }}
                        >
                          <Icon name="plus" size={12} />新建文档
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function DocumentList({
  title,
  documents,
  removable,
  onOpen
}: {
  title: string
  documents: MarkdownDocument[]
  removable: boolean
  onOpen: (document: MarkdownDocument) => void
}) {
  const [expanded, setExpanded] = useState(false)
  if (documents.length === 0) {
    return (
      <section className="border-b border-dove/20">
        <header className="h-11 flex items-center gap-2 px-5">
          <span className="text-[13px] font-medium text-ink">{title}</span>
          <span className="text-[11px] text-graphite">0</span>
        </header>
        <div className="px-5 py-3 text-[12px] text-graphite">没有匹配的结果</div>
      </section>
    )
  }
  const isExpanded = expanded || documents.length <= PREVIEW_LIMIT
  const slice = isExpanded ? documents : documents.slice(0, PREVIEW_LIMIT)
  return (
    <section className="border-b border-dove/20">
      <header className="h-11 flex items-center gap-2 px-5">
        <span className="text-[13px] font-medium text-ink">{title}</span>
        <span className="text-[11px] text-graphite">{documents.length}</span>
      </header>
      <ul className="pb-2">
        {slice.map((document) => (
          <li
            key={document.path}
            className="group flex items-center gap-3 px-5 py-2 hover:bg-fog transition-colors"
          >
            <button
              onClick={() => onOpen(document)}
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
              title={document.path}
            >
              <Icon name="note" size={15} className="text-graphite shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{document.name}</span>
                <span className="block truncate text-[11px] text-graphite">
                  {document.relativePath ?? document.path}
                </span>
              </span>
            </button>
            {removable && (
              <button
                onClick={() => void window.api.documents.forget(document.path)}
                title="从最近文档中移除"
                className="shrink-0 w-6 h-6 grid place-items-center rounded-full text-graphite opacity-0 group-hover:opacity-100 hover:text-rust hover:bg-pure-white transition-opacity"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {documents.length > PREVIEW_LIMIT && (
        <div className="flex items-center justify-center py-2">
          <button
            onClick={() => setExpanded(!isExpanded)}
            className="text-[11px] text-graphite hover:text-ink"
          >
            {isExpanded ? '收起' : `展开更多（共 ${documents.length} 条）`}
          </button>
        </div>
      )}
    </section>
  )
}
