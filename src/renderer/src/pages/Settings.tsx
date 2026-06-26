import React, { useEffect, useState } from 'react'
import { ipc } from '../lib/ipc'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Pill } from '../components/ui/Pill'
import { Icon } from '../components/ui/Icon'
import { LogoMark } from '../components/ui/LogoMark'
import type { AppRule } from '@shared/types'
import { categoryColor } from '../lib/format'

const CATEGORIES = ['开发', '办公', '社交', '浏览器', '娱乐', '其他'] as const

export function SettingsPage() {
  const [rules, setRules] = useState<AppRule[]>([])
  const [idle, setIdle] = useState('120')
  const [paused, setPaused] = useState(false)
  const [openAcc, setOpenAcc] = useState<string | null>('sampling')
  const [newRule, setNewRule] = useState({ pattern: '', category: '其他' as string })
  const [reclassifying, setReclassifying] = useState(false)
  const [reclassifyMessage, setReclassifyMessage] = useState<string | null>(null)

  const load = async () => {
    setRules(await ipc.rules.list())
    setIdle((await ipc.settings.get('idleThreshold')) ?? '120')
    setPaused(await ipc.tracking.isPaused())
  }

  useEffect(() => {
    load()
  }, [])

  const AccItem = ({
    id,
    title,
    desc,
    children
  }: {
    id: string
    title: string
    desc?: string
    children: React.ReactNode
  }) => {
    const isOpen = openAcc === id
    return (
      <Card className="!p-0 overflow-hidden">
        <button
          className="t-acc-trigger w-full flex items-center justify-between px-6 py-5 text-left hover:bg-fog/60 transition-colors"
          aria-expanded={isOpen}
          onClick={() => setOpenAcc(isOpen ? null : id)}
        >
          <div>
            <div className="text-[16px] font-medium text-ink">{title}</div>
            {desc && <div className="text-[13px] text-ash mt-0.5">{desc}</div>}
          </div>
          <svg
            className="t-acc-chevron text-graphite"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{ vectorEffect: 'non-scaling-stroke' }}
          >
            <path
              d="M4 10 L8 6 L12 10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className={`t-acc-panel ${isOpen ? 'is-open' : ''}`}>
          {/* padding 放在内容 wrapper 上，避免折叠容器因 padding 残留高度 */}
          <div className="t-acc-panel-inner">
            <div className="px-6 pb-6 pt-1">{children}</div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[720px] mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="title-eyebrow mb-1.5">Settings · 设置</div>
          <h1 className="serif text-[40px] text-ink" style={{ letterSpacing: '-0.8px', lineHeight: 1.1 }}>
            设置
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          <AccItem id="sampling" title="采样与记录" desc="控制前台窗口采样行为">
            <div className="flex flex-col gap-5 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium text-ink">空闲阈值（秒）</div>
                  <div className="text-[12px] text-graphite mt-0.5">
                    超过此空闲时间不计亮屏
                  </div>
                </div>
                <input
                  type="number"
                  value={idle}
                  min={30}
                  step={30}
                  onChange={(e) => setIdle(e.target.value)}
                  onBlur={() => ipc.settings.set('idleThreshold', idle)}
                  className="w-28 rounded-2xl border border-dove/60 bg-pure-white px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-rust transition-colors"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium text-ink">记录状态</div>
                  <div className="text-[12px] text-graphite mt-0.5">
                    {paused ? '已暂停，不再采样' : '正在持续记录亮屏时长'}
                  </div>
                </div>
                <Button
                  variant={paused ? 'primary' : 'link'}
                  onClick={() => ipc.tracking.setPaused(!paused).then(() => load())}
                >
                  {paused ? '恢复记录' : '暂停记录'}
                </Button>
              </div>
            </div>
          </AccItem>

          <AccItem id="rules" title="应用分类规则" desc="按 exePath / appName 模糊匹配归类">
            <div className="flex flex-col gap-3 pt-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-2xl border border-dove/60 bg-pure-white px-3.5 py-2 text-[14px] focus:outline-none focus:border-rust transition-colors"
                  placeholder="匹配字符串（如 code）"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                />
                <select
                  className="rounded-2xl border border-dove/60 bg-pure-white px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-rust cursor-pointer"
                  value={newRule.category}
                  onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!newRule.pattern.trim()) return
                    await ipc.rules.upsert({
                      pattern: newRule.pattern.trim(),
                      category: newRule.category as AppRule['category'],
                      enabled: 1
                    })
                    setNewRule({ pattern: '', category: '其他' })
                    setReclassifyMessage('历史分类已按新规则刷新')
                    load()
                  }}
                >
                  添加
                </Button>
              </div>
              {/* 规则列表：自带滚动，不限制整体高度 */}
              <div className="flex flex-col gap-1">
                {rules.length === 0 ? (
                  <div className="text-[13px] text-graphite py-4 text-center">
                    暂无规则，添加一条来自动分类应用
                  </div>
                ) : (
                  rules.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2.5 py-2 border-b border-dove/30 last:border-0"
                    >
                      <code className="text-[13px] text-ash bg-fog px-2.5 py-1 rounded-lg flex-1 truncate font-mono">
                        {r.pattern}
                      </code>
                      <Pill color={categoryColor(r.category)}>{r.category}</Pill>
                      <button
                        className="w-7 h-7 grid place-items-center rounded-full text-graphite hover:text-rust hover:bg-apricot-wash/60 transition-colors"
                        onClick={async () => {
                          await ipc.rules.delete(r.id)
                          setReclassifyMessage('历史分类已按当前规则刷新')
                          load()
                        }}
                        aria-label="删除规则"
                      >
                        <Icon name="close" size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-[12px] text-graphite">
                  {reclassifyMessage ?? '规则变更后会自动重算历史分类'}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  disabled={reclassifying}
                  onClick={async () => {
                    setReclassifying(true)
                    try {
                      const result = await ipc.rules.reclassifyUsage()
                      setReclassifyMessage(
                        `已扫描 ${result.scanned} 条记录，更新 ${result.updated} 条`
                      )
                    } finally {
                      setReclassifying(false)
                    }
                  }}
                >
                  {reclassifying ? '重算中' : '重算历史分类'}
                </Button>
              </div>
            </div>
          </AccItem>

          <AccItem id="privacy" title="隐私与数据" desc="数据仅本地存储">
            <div className="flex flex-col gap-3 pt-3 text-[14px] text-ash leading-relaxed">
              <p>所有采样数据仅存储在本机 SQLite，不发送到任何服务器。</p>
              <p>窗口标题可能包含敏感信息，可通过顶部「暂停记录」临时停止采集。</p>
              <div className="mt-2">
                <Button
                  variant="link"
                  onClick={async () => {
                    if (confirm('确定清空全部使用时长记录？此操作不可恢复。')) {
                      // 通过设置触发清空（主进程可扩展，此处仅提示）
                      await ipc.settings.set('clearRequested', String(Date.now()))
                    }
                  }}
                >
                  清空使用记录
                </Button>
              </div>
            </div>
          </AccItem>

          <Card className="!p-5 flex items-center gap-4">
            <LogoMark size={52} className="shrink-0 text-ink" />
            <div className="min-w-0">
              <div className="serif text-[22px] text-ink" style={{ letterSpacing: '-0.4px' }}>
                TodoMark
              </div>
              <div className="text-[13px] text-ash mt-1">
                本地优先的时间管理 · 应用使用统计、Markdown 笔记与待办提醒
              </div>
            </div>
          </Card>
          <div className="hidden">
            TodoMark · 本地优先的时间管理
          </div>
        </div>
      </div>
    </div>
  )
}
