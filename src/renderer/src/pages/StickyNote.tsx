import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'
import { Icon } from '@renderer/components/ui/Icon'
import type { Note } from '@shared/types'

function StickyReadOnlyEditor({ content }: { content: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!rootRef.current) return
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
      }
    })
    crepe.setReadonly(true)
    void crepe.create()
    return () => {
      void crepe.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <div ref={rootRef} className="h-full sticky-crepe" />
}

export function StickyNotePage() {
  const params = useParams<{ noteId: string }>()
  const id = params.noteId ? decodeURIComponent(params.noteId) : ''
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [alwaysOnTop, setAlwaysOnTop] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!id) {
        setLoading(false)
        return
      }
      const next = await window.api.notes.get(id)
      if (!alive) return
      setNote(next)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [id])

  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties
  const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties

  const toggleAlwaysOnTop = async () => {
    const next = await window.api.stickyNotes.setAlwaysOnTop(id, !alwaysOnTop)
    setAlwaysOnTop(next)
  }

  const close = () => {
    window.api.stickyNotes.close(id)
  }

  return (
    <div className="h-full bg-transparent p-1 overflow-hidden">
      <section className="h-full flex flex-col rounded-xl border border-dove/40 bg-pure-white shadow-[var(--shadow-lift)] overflow-hidden">
        <header
          className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-dove/30 select-none"
          style={drag}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink truncate">
              {note?.title?.trim() || '无标题'}
            </div>
          </div>
          <div className="flex items-center gap-1" style={noDrag}>
            {note && (
              <>
                <button
                  className="sticky-note-control"
                  onClick={() => window.api.stickyNotes.edit(id)}
                  aria-label="编辑"
                  title="编辑"
                >
                  <Icon name="edit" size={14} strokeWidth={1.7} />
                </button>
                <button
                  className={`sticky-note-control ${alwaysOnTop ? 'is-active' : ''}`}
                  onClick={toggleAlwaysOnTop}
                  aria-label={alwaysOnTop ? '取消置顶' : '置顶'}
                  title={alwaysOnTop ? '取消置顶' : '置顶'}
                >
                  <Icon name="pin" size={14} strokeWidth={1.7} />
                </button>
              </>
            )}
            <button className="sticky-note-control" onClick={close} aria-label="关闭" title="关闭">
              <Icon name="close" size={15} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-3" data-color-mode="light">
          {loading ? (
            <div className="space-y-2">
              <div className="t-skel h-5 w-3/4" />
              <div className="t-skel h-4 w-full" />
              <div className="t-skel h-4 w-5/6" />
            </div>
          ) : note ? (
            <StickyReadOnlyEditor content={note.content || '空笔记'} />
          ) : (
            <div className="h-full grid place-items-center text-center">
              <div>
                <div className="text-[14px] font-semibold text-ink">笔记不存在</div>
                <div className="mt-1 text-[12px] text-graphite">这条笔记可能已被删除。</div>
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  )
}
