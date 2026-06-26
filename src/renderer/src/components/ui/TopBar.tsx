import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ipc } from '../../lib/ipc'
import { useUsageStore } from '../../store/usage'
import { formatDuration } from '../../lib/format'
import { Tooltip } from '../ui/Tooltip'
import { Icon, type IconName } from './Icon'
import { WindowControls } from './WindowControls'
import { IconSwap } from './IconSwap'
import { LogoMark } from './LogoMark'
import type { Kpi } from '@shared/types'

export function TopBar() {
  const navigate = useNavigate()
  const { paused, loadPaused, setPaused } = useUsageStore()
  const [kpi, setKpi] = useState<Kpi | null>(null)

  useEffect(() => {
    loadPaused()
    const tick = async () => setKpi(await ipc.usage.kpi())
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [loadPaused])

  const navItems: { to: string; label: string; icon: IconName }[] = [
    { to: '/dashboard', label: '看板', icon: 'dashboard' },
    { to: '/notes', label: '笔记', icon: 'note' },
    { to: '/todos', label: '待办', icon: 'check' }
  ]

  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

  return (
    <header
      className="absolute top-0 left-0 right-0 z-50 bg-pure-white border-b border-dove/40 shadow-[0_1px_5px_rgba(4,23,43,0.06)] select-none"
      style={{ ...dragStyle, height: 'var(--topbar-h)' }}
    >
      <div className="mx-auto h-full flex items-center gap-3 px-5">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          style={noDrag}
          onClick={() => navigate('/dashboard')}
        >
          <LogoMark size={34} className="shrink-0 text-ink" />
          <span className="serif text-[20px] text-ink" style={{ letterSpacing: '-0.4px' }}>
            NOTE ONE
          </span>
        </div>

        {/* 导航 */}
        <nav className="flex items-center gap-1 ml-2" style={noDrag}>
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[14px] font-medium transition-colors ${
                  isActive
                    ? 'text-ink bg-fog'
                    : 'text-graphite hover:text-ink hover:bg-fog'
                }`
              }
            >
              <Icon name={it.icon} size={16} strokeWidth={1.6} />
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {/* 右侧：今日时长 + 暂停 + 设置 */}
        <div className="flex items-center gap-2" style={noDrag}>
          <Tooltip label={paused ? '记录已暂停' : '正在记录亮屏时长'}>
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-medium ${
                paused ? 'bg-fog text-graphite' : 'bg-fog text-ink'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-dove' : 'bg-rust'}`}
                style={paused ? undefined : { animation: 'pulse 2.5s ease-in-out infinite' }}
              />
              今日 {kpi ? formatDuration(kpi.todaySec) : '—'}
            </div>
          </Tooltip>

          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[14px] font-medium text-ash hover:text-ink hover:bg-fog transition-colors"
            onClick={() => setPaused(!paused)}
          >
            <IconSwap
              active={paused ? 1 : 0}
              icons={[
                <Icon name="pause" size={14} strokeWidth={1.7} />,
                <Icon name="play" size={14} strokeWidth={1.7} />
              ]}
            />
            {paused ? '恢复' : '暂停'}
          </button>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `w-9 h-9 grid place-items-center rounded-full transition-colors ${
                isActive ? 'bg-fog text-ink' : 'text-graphite hover:text-ink hover:bg-fog'
              }`
            }
          >
            <Icon name="settings" size={17} strokeWidth={1.6} />
          </NavLink>
        </div>

        <WindowControls />
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </header>
  )
}
