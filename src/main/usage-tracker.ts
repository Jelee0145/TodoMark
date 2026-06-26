import { powerMonitor } from 'electron'
import { activeWindow } from 'active-win'
import { classifyByRules, getSetting, insertSample } from './db'

let timer: NodeJS.Timeout | null = null
const SAMPLE_INTERVAL = 5000

export function startTracker(): void {
  stopTracker()
  timer = setInterval(tick, SAMPLE_INTERVAL)
}

export function stopTracker(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function tick(): Promise<void> {
  try {
    if (getSetting('paused') === '1') return

    const threshold = Number(getSetting('idleThreshold') ?? '120')
    const idleSec = powerMonitor.getSystemIdleTime()
    // 空闲超过阈值视为不在场，不计
    if (idleSec >= threshold) return

    const win = await activeWindow()
    if (!win) {
      // 亮屏但拿不到窗口（如锁屏界面），仅记亮屏不计应用
      insertSample(Date.now(), {
        appName: null,
        windowTitle: null,
        exePath: null,
        category: null,
        active: 1
      })
      return
    }

    const category = classifyByRules(win.owner?.path, win.owner?.name)
    insertSample(Date.now(), {
      appName: win.owner?.name ?? 'Unknown',
      windowTitle: win.title ?? '',
      exePath: win.owner?.path ?? '',
      category,
      active: 1
    })
  } catch (err) {
    // 采样失败不打断后续轮询
    console.error('[usage-tracker] sample error:', err)
  }
}
