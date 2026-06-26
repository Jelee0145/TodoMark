import React from 'react'
import { ipc } from '../../lib/ipc'
import { appColor, formatDuration } from '../../lib/format'
import type { RangeKey } from '@shared/types'
import { Card } from '../ui/Card'
import { useAsync } from '../../lib/useAsync'

interface Props {
  range: RangeKey
}

const BAR_MAX = 320

export function AppRanking({ range }: Props) {
  const { data } = useAsync(() => ipc.usage.ranking(range, 10), [range])
  const items = data ?? []
  const max = Math.max(1, ...items.map((d) => d.sec))

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[9px] font-medium text-ink">应用排行</h3>
        <span className="text-[7px] text-ash">Top 10</span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-[7px] text-graphite">暂无数据</div>
      ) : (
        <svg
          viewBox={`0 0 ${BAR_MAX + 180} ${items.length * 18}`}
          className="w-full"
          preserveAspectRatio="xMinYMin meet"
        >
          {items.map((d, i) => {
            const y = i * 18 + 3
            const w = (d.sec / max) * BAR_MAX
            return (
              <g key={d.app}>
                <text x={0} y={y + 7} className="fill-dove" style={{ fontSize: 6, fontWeight: 500 }}>
                  {i + 1}
                </text>
                <text x={22} y={y + 7} className="fill-ink" style={{ fontSize: 7 }}>
                  {d.app.length > 16 ? d.app.slice(0, 15) + '…' : d.app}
                </text>
                <rect x={22} y={y + 10} width={BAR_MAX} height={2.5} fill="#f7f7f8" rx={1.25} />
                <rect
                  x={22}
                  y={y + 10}
                  width={w}
                  height={2.5}
                  fill={appColor(d.app)}
                  rx={1.25}
                  style={{ transition: 'width 600ms cubic-bezier(0.22,1,0.36,1)' }}
                />
                <text
                  x={BAR_MAX + 30}
                  y={y + 7}
                  className="fill-ash"
                  style={{ fontSize: 6 }}
                  textAnchor="end"
                >
                  {formatDuration(d.sec)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </Card>
  )
}
