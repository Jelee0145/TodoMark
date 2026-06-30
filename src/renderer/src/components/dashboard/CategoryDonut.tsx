import React, { useMemo, useState } from 'react'
import { ipc } from '../../lib/ipc'
import { categoryColor, formatDuration } from '../../lib/format'
import type { RangeKey } from '@shared/types'
import { Card } from '../ui/Card'
import { useAsync } from '../../lib/useAsync'

interface Props {
  range: RangeKey
}

const R = 64
const r = 42

function polar(cx: number, cy: number, rad: number, a: number) {
  return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) }
}
function arcPath(cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number) {
  const sweep = a1 - a0
  if (sweep <= 0) return ''
  const large = sweep > Math.PI ? 1 : 0
  const p0 = polar(cx, cy, rOut, a0)
  const p1 = polar(cx, cy, rOut, a1)
  const p2 = polar(cx, cy, rIn, a1)
  const p3 = polar(cx, cy, rIn, a0)
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${p3.x} ${p3.y}`,
    'Z'
  ].join(' ')
}

export function CategoryDonut({ range }: Props) {
  const { data, loading } = useAsync(() => ipc.usage.categories(range), [range])
  const slices = data ?? []
  const [hover, setHover] = useState<number | null>(null)
  const total = slices.reduce((s, d) => s + d.sec, 0)

  const segments = useMemo(() => {
    if (total <= 0) return []
    let acc = -Math.PI / 2
    return slices.map((s) => {
      const frac = s.sec / total
      const start = acc
      const end = acc + frac * 2 * Math.PI
      acc = end
      return { ...s, start, end }
    })
  }, [slices, total])

  const cx = 90
  const cy = 90

  return (
    // Warm Data Card：Apricot Wash 底，Rust 描边图表（DESIGN.md 组件规范）
    <Card tone="warm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[18px] font-medium text-ink">分类占比</h3>
        <span className="text-[13px] text-ash">按规则分类</span>
      </div>

      <div className="flex items-center gap-6">
        <svg viewBox="0 0 180 180" width="180" height="180" className="shrink-0">
          {loading || total === 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={(R + r) / 2}
              fill="none"
              stroke="rgba(93,42,26,0.15)"
              strokeWidth={R - r}
            />
          ) : (
            segments.map((seg, i) => (
              <path
                key={seg.category}
                d={arcPath(cx, cy, R, r, seg.start, seg.end)}
                fill={categoryColor(seg.category)}
                opacity={hover === null || hover === i ? 1 : 0.35}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: 'opacity 200ms ease' }}
              />
            ))
          )}
          <text x={cx} y={cy - 6} textAnchor="middle" className="fill-rust" style={{ fontSize: 11, fontWeight: 500 }}>
            总时长
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="serif"
            style={{ fontSize: 18, fontWeight: 400, letterSpacing: '-0.3px' }}
            fill="#17191c"
          >
            {formatDuration(hover !== null ? slices[hover]?.sec ?? total : total)}
          </text>
        </svg>

        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {slices.length === 0 ? (
            <div className="text-[13px] text-graphite py-6 text-center">暂无数据</div>
          ) : (
            slices.map((d, i) => (
              <div
                key={d.category}
                className={`flex items-center gap-2 text-[13px] transition-opacity ${
                  hover === null || hover === i ? '' : 'opacity-40'
                }`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: categoryColor(d.category) }} />
                <span className="text-ink flex-1 truncate">{d.category}</span>
                <span className="text-ash tabular-nums">{formatDuration(d.sec)}</span>
                <span className="text-graphite w-9 text-right tabular-nums">
                  {Math.round((d.sec / Math.max(1, total)) * 100)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  )
}
