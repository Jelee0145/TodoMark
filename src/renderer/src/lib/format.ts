// 时长秒 → "1h 23m" / "23m" / "45s"
export function formatDuration(sec: number): string {
  if (sec <= 0) return '0m'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

// 时长秒 → "1:23:45"
export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${h}:${pad(m)}:${pad(s)}`
}

export function toDateIso(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function todayIso(): string {
  return toDateIso(Date.now())
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return WEEK[d.getDay()] ?? ''
}
export function mdShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
export function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

// 应用色：DESIGN.md 只给图表两个色相（Rust 暖 + 蓝 冷）。
// 应用排行/时间河需区分多应用 → 用冷蓝阶派生 + 暖 Rust 做高亮，避免引入饱和绿/红。
const APP_PALETTE = [
  '#4a90e2', // cool blue（主）
  '#5d2a1a', // rust
  '#7fb0ed',
  '#8a4a36',
  '#a8c8f2',
  '#b57a63',
  '#3a6fb0',
  '#c9a89a'
]
export function appColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return APP_PALETTE[hash % APP_PALETTE.length]!
}

// 分类色：暖(Rust 系)与冷(蓝系)交替，保持系统双色相纪律
export function categoryColor(cat: string): string {
  switch (cat) {
    case '开发':
      return '#5d2a1a' // Rust —— 核心工作
    case '办公':
      return '#8a4a36' // 暖中
    case '社交':
      return '#c9a89a' // 暖浅
    case '浏览器':
      return '#4a90e2' // cool blue
    case '娱乐':
      return '#7fb0ed' // 冷中
    case '其他':
      return '#a3a6af' // Dove 中性灰
    default:
      return '#a3a6af'
  }
}

// 热力色阶（浅底）：从极淡 ink 灰 → Apricot Wash → Rust
// 空格用可见的淡 ink 灰，确保在白/雾底上能看见格子
const HEAT_STOPS = ['#fbe1d1', '#f0bd9a', '#c9703f', '#5d2a1a']
export function heatColor(intensity: number): string {
  if (intensity <= 0) return 'rgba(23,25,28,0.08)' // 空格：可见的淡灰
  if (intensity < 0.25) return HEAT_STOPS[0]!
  if (intensity < 0.5) return HEAT_STOPS[1]!
  if (intensity < 0.75) return HEAT_STOPS[2]!
  return HEAT_STOPS[3]!
}
