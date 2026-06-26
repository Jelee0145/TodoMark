import React, { useEffect, useState } from 'react'
import { Icon } from './Icon'

// 应用内窗口控制按钮（替代原生标题栏）
// 使用胶囊形工具栏样式，与系统原生按钮形成明显区分
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let off: (() => void) | undefined
    ;(async () => {
      setMaximized(await window.api.window.isMaximized())
      off = window.api.window.onMaximizeChange((m) => setMaximized(m))
    })()
    return () => off?.()
  }, [])

  return (
    <div
      className="flex items-center gap-0.5 pl-1 pr-0.5 py-0.5 bg-fog/60 rounded-lg border border-dove/30"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        className="w-8 h-7 grid place-items-center rounded-md text-graphite hover:text-ink hover:bg-pure-white transition-colors"
        onClick={() => window.api.window.minimize()}
        aria-label="最小化"
        title="最小化"
      >
        <Icon name="minimize" size={14} strokeWidth={1.8} />
      </button>
      <button
        className="w-8 h-7 grid place-items-center rounded-md text-graphite hover:text-ink hover:bg-pure-white transition-colors"
        onClick={() => window.api.window.maximize().then(setMaximized)}
        aria-label={maximized ? '向下还原' : '最大化'}
        title={maximized ? '向下还原' : '最大化'}
      >
        <Icon name={maximized ? 'unmaximize' : 'maximize'} size={12} strokeWidth={1.6} />
      </button>
      <button
        className="w-8 h-7 grid place-items-center rounded-md text-graphite hover:text-rust hover:bg-apricot-wash transition-colors"
        onClick={() => window.api.window.close()}
        aria-label="关闭"
        title="关闭"
      >
        <Icon name="close" size={14} strokeWidth={1.8} />
      </button>
    </div>
  )
}
