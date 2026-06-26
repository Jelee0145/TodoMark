import React, { useEffect, useMemo, useState } from 'react'
import { ipc } from '../../lib/ipc'
import { appColor, hourLabel, todayIso } from '../../lib/format'
import type { TimeRiverPoint } from '@shared/types'
import { Card } from '../ui/Card'
import { useAsync } from '../../lib/useAsync'

const W = 560
const H = 200
const PAD = { top: 8, right: 8, bottom: 22, left: 8 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom

export function TimeRiver() {
  const { data } = useAsync(() => ipc.usage.timeRiver(todayIso()), [])
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const apps = useMemo(() => {
    const set = new Set<string>()
    ;(data ?? []).forEach((p) => p.apps.forEach((a) => set.add(a.name)))
    return Array.from(set)
  }, [data])

  const points: TimeRiverPoint[] = data ?? []
  const maxSec = Math.max(1, ...points.map((p) => p.apps.reduce((s, a) => s + a.sec, 0)))
  const barW = innerW / 24
  const x = (h: number) => PAD.left + h * barW
  const baseY = PAD.top + innerH

  return (
    // Cool Data Card：Sky Wash 底，蓝调图表
    <Card tone="cool">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-medium text-ink">今日时间河</h3>
        <span className="text-[13px] text-ash">按应用分层 · 5 秒采样</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[200px]">
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={baseY}
          y2={baseY}
          stroke="#4a90e2"
          strokeOpacity={0.3}
        />

        {points.map((p) => {
          let acc = 0
          return (
            <g key={p.hour}>
              {p.apps.map((a) => {
                const segH = (a.sec / maxSec) * innerH
                const segY = baseY - ((acc + a.sec) / maxSec) * innerH
                acc += a.sec
                return (
                  <rect
                    key={a.name}
                    x={x(p.hour) + 1}
                    y={segY}
                    width={barW - 2}
                    height={Math.max(0, segH)}
                    fill={appColor(a.name)}
                    rx={1.5}
                  />
                )
              })}
            </g>
          )
        })}

        {[0, 6, 12, 18, 23].map((h) => (
          <text
            key={h}
            x={x(h) + barW / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-dove"
            style={{ fontSize: 11 }}
          >
            {hourLabel(h)}
          </text>
        ))}
      </svg>

      {apps.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-dove/40">
          {apps.slice(0, 8).map((name) => (
            <div key={name} className="flex items-center gap-1.5 text-[12px] text-ash">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: appColor(name) }} />
              <span className="truncate max-w-[120px]">{name}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
