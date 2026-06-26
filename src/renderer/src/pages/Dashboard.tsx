import React, { useEffect, useState } from 'react'
import { Heatmap } from '../components/dashboard/Heatmap'
import { TimeRiver } from '../components/dashboard/TimeRiver'
import { CategoryDonut } from '../components/dashboard/CategoryDonut'
import { AppRanking } from '../components/dashboard/AppRanking'
import { TrendChart } from '../components/dashboard/TrendChart'
import { Card } from '../components/ui/Card'
import { Icon, type IconName } from '../components/ui/Icon'
import { NumberPopIn } from '../components/ui/NumberPopIn'
import { ipc } from '../lib/ipc'
import { formatDuration, hourLabel } from '../lib/format'
import type { Kpi } from '@shared/types'

export function DashboardPage() {
  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-[1200px] mx-auto px-6 pb-8 flex flex-col" style={{ gap: 80 /* DESIGN.md section-gap */ }}>
      {/* Hero 段：白画布 + 暖色径向光晕（仅此处用暖光） */}
      <section className="relative overflow-hidden rounded-3xl">
        {/* 暖色径向光晕背景层 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 80% at 50% 0%, rgba(251,225,209,0.7) 0%, rgba(255,255,255,0) 70%)'
          }}
        />
        <div className="relative px-8 pt-14 pb-10">
          <div className="title-eyebrow text-center">Dashboard · 看板</div>
          <h1
            className="serif text-[56px] text-ink text-center mt-3"
            style={{ letterSpacing: '-1.4px', lineHeight: 1.08 }}
          >
            你的时间，正在被看清。
          </h1>
          <p className="text-[17px] text-ash text-center mt-3 max-w-[560px] mx-auto">
            24×7 亮屏矩阵 · 每 5 秒采样前台窗口 · 全部本地存储
          </p>

          {/* KPI 行：白卡 + 签名阴影 */}
          <div className="mt-10">
            <KpiCards />
          </div>

          {/* 热力图英雄区 */}
          <div className="mt-8">
            <Card className="!p-6">
              <div className="flex items-center gap-2 mb-5">
                <Icon name="chart" size={18} strokeWidth={1.7} className="text-rust" />
                <h3 className="text-[18px] font-medium text-ink">
                  活跃矩阵 · 近 7 日 × 24 小时
                </h3>
              </div>
              <Heatmap />
            </Card>
          </div>
        </div>
      </section>

      {/* 第二段：数据卡片网格（白 / 暖 / 冷交替） */}
      <section className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeRiver />
          <CategoryDonut range="week" />
        </div>
        <AppRanking range="week" />
        <TrendChart />
      </section>
    </div>
    </div>
  )
}

// 白卡 KPI（Stat Card with Delta 风格）
function KpiCards() {
  const [kpi, setKpi] = useState<Kpi | null>(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const k = await ipc.usage.kpi()
      if (alive) setKpi(k)
    }
    tick()
    const t = setInterval(tick, 30_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const items: { label: string; value: string; icon: IconName }[] = [
    { label: '今日亮屏', value: kpi ? formatDuration(kpi.todaySec) : '—', icon: 'bolt' },
    { label: '最专注应用', value: kpi?.topApp ?? '—', icon: 'flame' },
    {
      label: '峰值时段',
      value:
        kpi?.peakHour !== undefined && kpi?.peakHour !== null ? hourLabel(kpi.peakHour) : '—',
      icon: 'clock'
    },
    { label: '本周累计', value: kpi ? formatDuration(kpi.weekSec) : '—', icon: 'layers' }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((it) => (
        <Card key={it.label} className="!p-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-graphite font-medium">{it.label}</span>
            <Icon name={it.icon} size={16} strokeWidth={1.6} className="text-graphite" />
          </div>
          {kpi ? (
            <div
              className="serif text-ink mt-2 truncate"
              style={{ fontSize: 30, letterSpacing: '-0.6px', lineHeight: 1.1 }}
            >
              <NumberPopIn value={it.value} />
            </div>
          ) : (
            <div className="t-skel h-[30px] w-20 mt-2" />
          )}
        </Card>
      ))}
    </div>
  )
}
