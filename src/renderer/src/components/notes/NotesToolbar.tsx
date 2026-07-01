import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { commandsCtx } from '@milkdown/kit/core'
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  insertImageCommand,
  insertHrCommand,
  createCodeBlockCommand
} from '@milkdown/preset-commonmark'
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm'
import { insertTableCommand } from '@milkdown/preset-gfm'
import { undoCommand, redoCommand } from '@milkdown/plugin-history'
import type { Crepe } from '@milkdown/crepe'
import {
  IconBold,
  IconItalic,
  IconStrike,
  IconQuote,
  IconUl,
  IconOl,
  IconTask,
  IconImage,
  IconUndo,
  IconRedo,
  IconLink,
  IconCode,
  IconTable,
  IconHr,
  IconMore
} from './NotesToolbarIcons'

type BtnProps = {
  title: string
  onClick: () => void
  active?: boolean
  highlight?: boolean
  children: React.ReactNode
}

function Btn({ title, onClick, active, highlight, children }: BtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`ntb-btn${active ? ' is-active' : ''}${highlight ? ' is-highlight' : ''}`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="ntb-divider" aria-hidden="true" />
}

function TextBtn({ label, title, onClick, active }: { label: string; title: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} className={`ntb-text-btn${active ? ' is-active' : ''}`}>
      {label}
    </button>
  )
}

function callCommand(ctx: unknown, key: unknown, ...args: unknown[]) {
  const commands = (ctx as { get: (s: unknown) => { call: (k: unknown, ...a: unknown[]) => boolean } }).get(commandsCtx)
  return commands.call(key, ...args)
}

function runCommand(
  crepeRef: React.MutableRefObject<Crepe | null>,
  key: unknown,
  ...args: unknown[]
) {
  const crepe = crepeRef.current
  if (!crepe) return
  const editor = crepe.editor
  if (!editor) return
  editor.action((ctx) => {
    callCommand(ctx, key, ...args)
  })
}

type PromptKind = 'image' | 'link' | null

function PromptModal({
  kind,
  onClose,
  onConfirm
}: {
  kind: Exclude<PromptKind, null>
  onClose: () => void
  onConfirm: (value: string) => void
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  const placeholder = kind === 'image' ? 'https://example.com/image.png' : 'https://example.com'
  const label = kind === 'image' ? '图片地址' : '链接地址'
  return createPortal(
    <div className="ntb-modal-backdrop" onClick={onClose}>
      <div className="ntb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ntb-modal-title">{label}</div>
        <input
          ref={inputRef}
          type="text"
          className="ntb-modal-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirm(value)
            if (e.key === 'Escape') onClose()
          }}
        />
        <div className="ntb-modal-actions">
          <button type="button" className="ntb-modal-btn" onClick={onClose}>取消</button>
          <button
            type="button"
            className="ntb-modal-btn is-primary"
            disabled={!value.trim()}
            onClick={() => onConfirm(value)}
          >确定</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function NotesToolbar({ crepeRef }: { crepeRef: React.MutableRefObject<Crepe | null> }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [prompt, setPrompt] = useState<PromptKind>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [moreOpen])

  const exec = (key: unknown, ...args: unknown[]) => {
    runCommand(crepeRef, key, ...args)
  }

  const insertImageFromUrl = useCallback((url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    const crepe = crepeRef.current
    if (!crepe) return
    crepe.editor.action((ctx) => {
      callCommand(ctx, insertImageCommand.key, { src: trimmed, alt: '' })
    })
  }, [crepeRef])

  const insertLinkFromUrl = useCallback((url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    const crepe = crepeRef.current
    if (!crepe) return
    crepe.editor.action((ctx) => {
      callCommand(ctx, toggleLinkCommand.key, trimmed)
    })
  }, [crepeRef])

  const insertCode = () => exec(createCodeBlockCommand.key)
  const insertTable = () => exec(insertTableCommand.key)
  const insertHr = () => exec(insertHrCommand.key)

  const undo = () => exec(undoCommand.key)
  const redo = () => exec(redoCommand.key)
  const h1 = () => exec(wrapInHeadingCommand.key, 1)
  const h2 = () => exec(wrapInHeadingCommand.key, 2)
  const h3 = () => exec(wrapInHeadingCommand.key, 3)
  const bold = () => exec(toggleStrongCommand.key)
  const italic = () => exec(toggleEmphasisCommand.key)
  const code = () => exec(toggleInlineCodeCommand.key)
  const strike = () => exec(toggleStrikethroughCommand.key)
  const bullet = () => exec(wrapInBulletListCommand.key)
  const ordered = () => exec(wrapInOrderedListCommand.key)
  const task = () => {
    exec(wrapInBulletListCommand.key)
    setTimeout(() => {
      const ta = document.querySelector('.milkdown .ProseMirror') as HTMLElement | null
      ta?.focus()
    }, 0)
  }
  const quote = () => exec(wrapInBlockquoteCommand.key)

  return (
    <div className="ntb-root">
      <Btn title="撤销" onClick={undo}><IconUndo /></Btn>
      <Btn title="重做" onClick={redo}><IconRedo /></Btn>
      <Divider />
      <TextBtn label="H₁" title="一级标题" onClick={h1} />
      <TextBtn label="H₂" title="二级标题" onClick={h2} />
      <TextBtn label="H₃" title="三级标题" onClick={h3} />
      <Divider />
      <Btn title="加粗" onClick={bold}><IconBold /></Btn>
      <Btn title="斜体" onClick={italic}><IconItalic /></Btn>
      <Btn title="行内代码" onClick={code}><IconCode /></Btn>
      <Btn title="删除线" onClick={strike}><IconStrike /></Btn>
      <Divider />
      <Btn title="无序列表" onClick={bullet}><IconUl /></Btn>
      <Btn title="有序列表" onClick={ordered}><IconOl /></Btn>
      <Btn title="任务列表" onClick={task}><IconTask /></Btn>
      <Btn title="引用" onClick={quote}><IconQuote /></Btn>
      <Divider />
      <Btn title="插入图片" onClick={() => setPrompt('image')}><IconImage /></Btn>
      <div className="ntb-more-wrap" ref={moreRef}>
        <Btn title="更多" onClick={() => setMoreOpen((v) => !v)} highlight={moreOpen}><IconMore /></Btn>
        {moreOpen && (
          <div className="ntb-more-menu" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { setMoreOpen(false); setPrompt('link') }}><IconLink />链接</button>
            <button type="button" onClick={() => { insertCode(); setMoreOpen(false) }}><IconCode />代码块</button>
            <button type="button" onClick={() => { insertTable(); setMoreOpen(false) }}><IconTable />表格</button>
            <button type="button" onClick={() => { insertHr(); setMoreOpen(false) }}><IconHr />分隔线</button>
          </div>
        )}
      </div>
      {prompt === 'image' && (
        <PromptModal
          kind="image"
          onClose={() => setPrompt(null)}
          onConfirm={(v) => { insertImageFromUrl(v); setPrompt(null) }}
        />
      )}
      {prompt === 'link' && (
        <PromptModal
          kind="link"
          onClose={() => setPrompt(null)}
          onConfirm={(v) => { insertLinkFromUrl(v); setPrompt(null) }}
        />
      )}
    </div>
  )
}
