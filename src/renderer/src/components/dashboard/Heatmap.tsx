import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ipc } from '../../lib/ipc'
import { heatColor, formatDuration, hourLabel, weekdayShort, mdShort } from '../../lib/format'
import type { HeatmapCell } from '@shared/types'
import { Skeleton } from '../ui/Skeleton'
import { NumberPopIn } from '../ui/NumberPopIn'
import { Icon } from '../ui/Icon'

// 矩阵：24 列 × 7 行，方框 + gap 尺寸根据容器宽度自适应
const COLS = 24
const ROWS = 7
const ROW_LABEL_W = 32 // 行标签列宽
const SIDE_PANEL_W = 280 // 右侧汇总卡宽度
const SIDE_GAP = 40 // 主区与汇总卡间距
const GAP_RATIO = 1 // gap = cell（让方框之间留出与自身等宽的间隙，呼吸感好）

export function Heatmap() {
  const [cells, setCells] = useState<HeatmapCell[]>([])
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<{ date: string; hour: number; sec: number } | null>(null)

  // 测量容器宽度 → 计算 cell 尺寸
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(10)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const compute = () => {
      const totalW = el.clientWidth
      // 主区宽度 = 容器宽 - 右侧卡 - 间距
      const mainW = Math.max(280, totalW - SIDE_PANEL_W - SIDE_GAP)
      // 主区内还要减去行标签列宽
      const gridW = mainW - ROW_LABEL_W
      // gridW = COLS*cell + (COLS-1)*gap，gap = cell*GAP_RATIO
      const c = Math.floor(gridW / (COLS + (COLS - 1) * GAP_RATIO))
      setCell(Math.max(6, Math.min(22, c)))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const gap = Math.max(2, Math.round(cell * GAP_RATIO))

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const data = await ipc.usage.heatmap('week')
      if (alive) {
        setCells(data)
        setLoading(false)
      }
    }
    tick()
    const t = setInterval(tick, 60_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const dates = useMemo(() => {
    const arr: string[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      arr.push(d.toISOString().slice(0, 10))
    }
    return arr
  }, [])

  const cellMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cells) {
      const k = `${c.date}|${c.hour}`
      m.set(k, (m.get(k) ?? 0) + c.sec)
    }
    return m
  }, [cells])

  const max = Math.max(1, ...Array.from(cellMap.values()))
  const total = Array.from(cellMap.values()).reduce((s, v) => s + v, 0)
  const activeCells = Array.from(cellMap.values()).filter((v) => v > 0).length
  const gridW = COLS * cell + (COLS - 1) * gap

  return (
    <Skeleton loading={loading} count={1} height={ROWS * (cell + gap) + 80}>
      <div ref={wrapRef} className="grid gap-10 items-start" style={{ gridTemplateColumns: `1fr ${SIDE_PANEL_W}px` }}>
        {/* 矩阵 */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex gap-3">
            {/* 行标签：周几 */}
            <div className="flex flex-col" style={{ gap }}>
              {dates.map((d) => (
                <div
                  key={d}
                  className="text-[11px] text-graphite font-medium leading-none flex items-center justify-end"
                  style={{ height: cell, width: ROW_LABEL_W - 12 }}
                >
                  {weekdayShort(d)}
                </div>
              ))}
            </div>

            {/* 矩阵主体 */}
            <div className="relative min-w-0">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, ${cell}px)`,
                  gridTemplateRows: `repeat(${ROWS}, ${cell}px)`,
                  gap
                }}
              >
                {dates.map((date) =>
                  Array.from({ length: COLS }).map((_, hour) => {
                    const sec = cellMap.get(`${date}|${hour}`) ?? 0
                    const intensity = sec / max
                    const isHover = hover?.date === date && hover?.hour === hour
                    return (
                      <div
                        key={`${date}-${hour}`}
                        className="rounded-[2px] relative cursor-default"
                        style={{
                          width: cell,
                          height: cell,
                          background: heatColor(intensity),
                          transform: isHover ? 'scale(1.8)' : 'scale(1)',
                          boxShadow: isHover ? '0 0 0 1.5px #17191c' : 'none',
                          zIndex: isHover ? 5 : 1,
                          transition: 'transform 120ms ease'
                        }}
                        onMouseEnter={() => setHover({ date, hour, sec })}
                        onMouseLeave={() => setHover(null)}
                      />
                    )
                  })
                )}
              </div>

              {/* 小时刻度 */}
              <div
                className="flex justify-between mt-2.5 text-[11px] text-dove tabular-nums"
                style={{ width: gridW }}
              >
                {[0, 4, 8, 12, 16, 20, 23].map((h) => (
                  <span key={h}>{hourLabel(h)}</span>
                ))}
              </div>
            </div>
          </div>

          {/* 图例 */}
          <div className="flex items-center gap-2 text-[12px] text-graphite">
            <span>少</span>
            {[0, 0.2, 0.4, 0.7, 1].map((i, idx) => (
              <span
                key={idx}
                style={{ width: cell + 3, height: cell + 3, background: heatColor(i), borderRadius: 2 }}
              />
            ))}
            <span>多</span>
          </div>
        </div>

        {/* 右侧汇总（雾底卡片） */}
        <div className="bg-fog rounded-3xl p-5">
          <div className="title-eyebrow">近 7 日亮屏</div>
          <div
            className="serif text-[40px] text-ink mt-1.5"
            style={{ letterSpacing: '-0.8px', lineHeight: 1.1 }}
          >
            <NumberPopIn value={formatDuration(total)} />
          </div>
          <div className="text-[12px] text-graphite mt-1">{activeCells} 个活跃时段</div>

          <div className="my-4 h-px bg-dove/40" />

          <div className="space-y-2.5 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="text-ash flex items-center gap-1.5">
                <Icon name="bolt" size={13} strokeWidth={1.7} /> 峰值
              </span>
              <span className="text-ink font-medium tabular-nums">{formatDuration(max)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ash flex items-center gap-1.5">
                <Icon name="clock" size={13} strokeWidth={1.7} /> 日均
              </span>
              <span className="text-ink font-medium tabular-nums">
                {formatDuration(Math.round(total / 7))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ash flex items-center gap-1.5">
                <Icon name="flame" size={13} strokeWidth={1.7} /> 时段
              </span>
              <span className="text-ink font-medium tabular-nums">
                {hover ? `${mdShort(hover.date)} ${hourLabel(hover.hour)}` : '悬停查看'}
              </span>
            </div>
            {hover && (
              <div className="pt-2.5 mt-2.5 border-t border-dove/40 text-ash">
                亮屏 {formatDuration(hover.sec)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Skeleton>
  )
}
