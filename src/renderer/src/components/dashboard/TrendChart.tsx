import React, { useState } from 'react'
import { ipc } from '../../lib/ipc'
import { formatDuration, mdShort } from '../../lib/format'
import { Card } from '../ui/Card'
import { useAsync } from '../../lib/useAsync'

const W = 560
const H = 200
const PAD = { top: 16, right: 16, bottom: 24, left: 32 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom

export function TrendChart() {
  const { data } = useAsync(() => ipc.usage.trend(7), [])

  const points = (data ?? []).map((d) => ({
    ...d,
    label: mdShort(d.date),
    hours: d.sec / 3600,
    prevHours: d.prevSec / 3600
  }))

  const allHours = points.flatMap((p) => [p.hours, p.prevHours])
  const maxY = Math.max(1, ...allHours, 4)
  const n = points.length

  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (h: number) => PAD.top + innerH - (h / maxY) * innerH

  const areaPath =
    points.length > 0
      ? `M ${x(0)} ${y(points[0]!.hours)} ` +
        points.slice(1).map((p, i) => `L ${x(i + 1)} ${y(p.hours)}`).join(' ') +
        ` L ${x(n - 1)} ${PAD.top + innerH} L ${x(0)} ${PAD.top + innerH} Z`
      : ''
  const linePath =
    points.length > 0
      ? `M ${x(0)} ${y(points[0]!.hours)} ` +
        points.slice(1).map((p, i) => `L ${x(i + 1)} ${y(p.hours)}`).join(' ')
      : ''
  const prevPath =
    points.length > 0
      ? `M ${x(0)} ${y(points[0]!.prevHours)} ` +
        points.slice(1).map((p, i) => `L ${x(i + 1)} ${y(p.prevHours)}`).join(' ')
      : ''

  const [hover, setHover] = useState<number | null>(null)
  const yTicks = [0, maxY / 2, maxY]

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-medium text-ink">7 日亮屏趋势</h3>
        <div className="flex items-center gap-3 text-[12px] text-graphite">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cool-blue" /> 本周
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rust" style={{ borderTop: '1px dashed #5d2a1a' }} /> 上周
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[200px]">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a90e2" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#4a90e2" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {yTicks.map((tv, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tv)}
              y2={y(tv)}
              stroke="#a3a6af"
              strokeOpacity={0.4}
              strokeDasharray={i === 0 ? '0' : '3 3'}
            />
            <text x={PAD.left - 8} y={y(tv) + 3} textAnchor="end" className="fill-dove" style={{ fontSize: 11 }}>
              {tv >= 1 ? `${Math.round(tv)}h` : ''}
            </text>
          </g>
        ))}

        {points.length > 0 && (
          <>
            <path d={areaPath} fill="url(#trendFill)" />
            {/* 上周：Rust 虚线 */}
            <path
              d={prevPath}
              fill="none"
              stroke="#5d2a1a"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            {/* 本周：蓝实线 */}
            <path
              d={linePath}
              fill="none"
              stroke="#4a90e2"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {points.map((p, i) => (
          <g key={i}>
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-dove" style={{ fontSize: 11 }}>
              {p.label}
            </text>
            <rect
              x={x(i) - innerW / (n * 2)}
              y={PAD.top}
              width={innerW / n}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {(hover === i || (hover === null && i === n - 1)) && (
              <circle cx={x(i)} cy={y(p.hours)} r={4} fill="#4a90e2" stroke="#fff" strokeWidth={2} />
            )}
          </g>
        ))}

        {points.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="fill-dove" style={{ fontSize: 13 }}>
            暂无数据
          </text>
        )}
      </svg>

      {hover !== null && points[hover] && (
        <div className="text-[13px] text-ash mt-1">
          <span className="font-medium text-ink">{points[hover].label}</span>
          <span className="mx-2 text-dove">·</span>
          本周 {formatDuration(Math.round(points[hover].hours * 3600))}
          <span className="mx-2 text-dove">·</span>
          上周 {formatDuration(Math.round(points[hover].prevHours * 3600))}
        </div>
      )}
    </Card>
  )
}
