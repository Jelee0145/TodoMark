import { createRequire } from 'node:module'
import type { Database } from 'better-sqlite3'
import type {
  AppRule,
  Category,
  CategorySlice,
  Group,
  HeatmapCell,
  Kpi,
  Note,
  RankItem,
  RangeKey,
  ReclassifyResult,
  TimeRiverPoint,
  Todo,
  TrendPoint
} from '../shared/types'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof import('better-sqlite3')

let db: Database

const SAMPLE_SEC = 5

export function initDatabase(dbPath: string): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  migrate()
  seedDefaults()
}

function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#0075de',
      sort INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      groupId TEXT REFERENCES groups(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT '无标题',
      content TEXT DEFAULT '',
      pinned INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notes_group ON notes(groupId);
    CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updatedAt DESC);

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      noteId TEXT REFERENCES notes(id) ON DELETE SET NULL,
      done INTEGER DEFAULT 0,
      dueAt INTEGER,
      remindAt INTEGER,
      notified INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_todos_remind ON todos(remindAt) WHERE done = 0;

    CREATE TABLE IF NOT EXISTS app_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sampleTs INTEGER NOT NULL,
      appName TEXT,
      windowTitle TEXT,
      exePath TEXT,
      category TEXT,
      active INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_usage_ts ON app_usage(sampleTs);
    CREATE INDEX IF NOT EXISTS idx_usage_app ON app_usage(appName);
    CREATE INDEX IF NOT EXISTS idx_usage_cat ON app_usage(category);

    CREATE TABLE IF NOT EXISTS app_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

const DEFAULT_RULES: { pattern: string; category: Category }[] = [
  { pattern: 'code', category: '开发' },
  { pattern: 'devenv', category: '开发' },
  { pattern: 'idea', category: '开发' },
  { pattern: 'webstorm', category: '开发' },
  { pattern: 'cursor', category: '开发' },
  { pattern: 'cmd.exe', category: '开发' },
  { pattern: 'powershell', category: '开发' },
  { pattern: 'windowsterminal', category: '开发' },
  { pattern: 'git', category: '开发' },
  { pattern: 'node', category: '开发' },
  { pattern: 'winword', category: '办公' },
  { pattern: 'excel', category: '办公' },
  { pattern: 'powerpnt', category: '办公' },
  { pattern: 'outlook', category: '办公' },
  { pattern: 'wps', category: '办公' },
  { pattern: 'dingtalk', category: '办公' },
  { pattern: 'wxwork', category: '办公' },
  { pattern: 'wechat', category: '社交' },
  { pattern: 'qq', category: '社交' },
  { pattern: 'telegram', category: '社交' },
  { pattern: 'discord', category: '社交' },
  { pattern: 'slack', category: '社交' },
  { pattern: 'chrome', category: '浏览器' },
  { pattern: 'msedge', category: '浏览器' },
  { pattern: 'firefox', category: '浏览器' },
  { pattern: 'brave', category: '浏览器' },
  { pattern: 'steam', category: '娱乐' },
  { pattern: 'spotify', category: '娱乐' },
  { pattern: 'vlc', category: '娱乐' }
]

function seedDefaults(): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM app_rules').get() as { c: number }
  if (count.c === 0) {
    const stmt = db.prepare('INSERT INTO app_rules (pattern, category, enabled) VALUES (?, ?, 1)')
    const tx = db.transaction((rows: typeof DEFAULT_RULES) => {
      for (const r of rows) stmt.run(r.pattern, r.category)
    })
    tx(DEFAULT_RULES)
  }

  const idleRow = db.prepare("SELECT value FROM settings WHERE key='idleThreshold'").get() as
    | { value: string }
    | undefined
  if (!idleRow) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('idleThreshold', '120')
  }
  const pauseRow = db.prepare("SELECT value FROM settings WHERE key='paused'").get() as
    | { value: string }
    | undefined
  if (!pauseRow) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('paused', '0')
  }
}

// ---------- 设置 ----------
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const out: Record<string, string> = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

// ---------- 分类规则 ----------
export function listRules(): AppRule[] {
  return db.prepare('SELECT * FROM app_rules ORDER BY id').all() as AppRule[]
}

export function upsertRule(rule: Partial<AppRule>): number {
  if (rule.id) {
    db.prepare(
      'UPDATE app_rules SET pattern = COALESCE(?, pattern), category = COALESCE(?, category), enabled = COALESCE(?, enabled) WHERE id = ?'
    ).run(rule.pattern ?? null, rule.category ?? null, rule.enabled ?? null, rule.id)
    reclassifyUsageCategories()
    return rule.id
  }
  const info = db
    .prepare('INSERT INTO app_rules (pattern, category, enabled) VALUES (?, ?, ?)')
    .run(rule.pattern ?? '', rule.category ?? '其他', rule.enabled ?? 1)
  reclassifyUsageCategories()
  return Number(info.lastInsertRowid)
}

export function deleteRule(id: number): void {
  db.prepare('DELETE FROM app_rules WHERE id = ?').run(id)
  reclassifyUsageCategories()
}

function getEnabledRules(): { pattern: string; category: Category }[] {
  return db
    .prepare('SELECT pattern, category FROM app_rules WHERE enabled = 1 ORDER BY id')
    .all() as { pattern: string; category: Category }[]
}

function classifyWithRules(
  rules: { pattern: string; category: Category }[],
  path: string | undefined | null,
  name: string | undefined | null
): Category {
  const hay = `${(path ?? '').toLowerCase()} ${(name ?? '').toLowerCase()}`
  for (const r of rules) {
    if (r.pattern && hay.includes(r.pattern.toLowerCase())) return r.category
  }
  return '其他'
}

export function classifyByRules(path: string | undefined, name: string | undefined): Category {
  return classifyWithRules(getEnabledRules(), path, name)
}

export function reclassifyUsageCategories(): ReclassifyResult {
  const rules = getEnabledRules()
  const rows = db
    .prepare(
      `SELECT id, appName, exePath, category
       FROM app_usage
       WHERE appName IS NOT NULL OR exePath IS NOT NULL`
    )
    .all() as {
      id: number
      appName: string | null
      exePath: string | null
      category: Category | null
    }[]
  const update = db.prepare('UPDATE app_usage SET category = ? WHERE id = ?')
  let updated = 0
  const tx = db.transaction(() => {
    for (const row of rows) {
      const next = classifyWithRules(rules, row.exePath, row.appName)
      if (row.category !== next) {
        update.run(next, row.id)
        updated += 1
      }
    }
  })
  tx()
  return { scanned: rows.length, updated }
}

// ---------- 采样写入 ----------
export interface UsageSample {
  appName: string | null
  windowTitle: string | null
  exePath: string | null
  category: Category | null
  active: number
}

export function insertSample(ts: number, s: UsageSample): void {
  db.prepare(
    'INSERT INTO app_usage (sampleTs, appName, windowTitle, exePath, category, active) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(ts, s.appName, s.windowTitle, s.exePath, s.category, s.active)
}

// ---------- 聚合查询 ----------
function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function rangeStartMs(range: RangeKey): number {
  const now = new Date()
  if (range === 'today') {
    now.setHours(0, 0, 0, 0)
    return now.getTime()
  }
  if (range === 'week') {
    const day = now.getDay() || 7 // 周一为1
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - (day - 1))
    return monday.getTime()
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

export function getKpi(): Kpi {
  const todayStart = startOfTodayMs()
  const weekStart = rangeStartMs('week')

  const todayRow = db
    .prepare('SELECT COUNT(*) * ? AS sec FROM app_usage WHERE active = 1 AND sampleTs >= ?')
    .get(SAMPLE_SEC, todayStart) as { sec: number }

  const weekRow = db
    .prepare('SELECT COUNT(*) * ? AS sec FROM app_usage WHERE active = 1 AND sampleTs >= ?')
    .get(SAMPLE_SEC, weekStart) as { sec: number }

  const topRow = db
    .prepare(
      `SELECT appName, COUNT(*) * ? AS sec FROM app_usage
       WHERE active = 1 AND sampleTs >= ? AND appName IS NOT NULL
       GROUP BY appName ORDER BY sec DESC LIMIT 1`
    )
    .get(SAMPLE_SEC, todayStart) as { appName: string; sec: number } | undefined

  const hourRow = db
    .prepare(
      `SELECT CAST(strftime('%H', sampleTs/1000, 'unixepoch', 'localtime') AS INTEGER) AS h,
              COUNT(*) * ? AS sec
       FROM app_usage WHERE active = 1 AND sampleTs >= ?
       GROUP BY h ORDER BY sec DESC LIMIT 1`
    )
    .get(SAMPLE_SEC, todayStart) as { h: number; sec: number } | undefined

  return {
    todaySec: todayRow.sec,
    weekSec: weekRow.sec,
    topApp: topRow?.appName ?? null,
    topAppSec: topRow?.sec ?? 0,
    peakHour: hourRow?.h ?? null
  }
}

export function getHeatmap(range: RangeKey): HeatmapCell[] {
  const start = rangeStartMs(range)
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m-%d', sampleTs/1000, 'unixepoch', 'localtime') AS date,
              CAST(strftime('%H', sampleTs/1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
              COUNT(*) * ? AS sec
       FROM app_usage WHERE active = 1 AND sampleTs >= ?
       GROUP BY date, hour`
    )
    .all(SAMPLE_SEC, start) as { date: string; hour: number; sec: number }[]
  return rows
}

export function getTimeRiver(dateIso: string): TimeRiverPoint[] {
  const start = new Date(`${dateIso}T00:00:00`).getTime()
  const end = start + 24 * 3600 * 1000
  const rows = db
    .prepare(
      `SELECT CAST(strftime('%H', sampleTs/1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
              appName, COUNT(*) * ? AS sec
       FROM app_usage
       WHERE active = 1 AND sampleTs >= ? AND sampleTs < ? AND appName IS NOT NULL
       GROUP BY hour, appName`
    )
    .all(SAMPLE_SEC, start, end) as { hour: number; appName: string; sec: number }[]

  const map = new Map<number, { name: string; sec: number }[]>()
  for (const r of rows) {
    if (!map.has(r.hour)) map.set(r.hour, [])
    map.get(r.hour)!.push({ name: r.appName, sec: r.sec })
  }
  const out: TimeRiverPoint[] = []
  for (let h = 0; h < 24; h++) {
    out.push({ hour: h, apps: map.get(h) ?? [] })
  }
  return out
}

export function getCategories(range: RangeKey): CategorySlice[] {
  const start = rangeStartMs(range)
  const rows = db
    .prepare(
      `SELECT COALESCE(category, '其他') AS category, COUNT(*) * ? AS sec
       FROM app_usage WHERE active = 1 AND sampleTs >= ?
       GROUP BY category ORDER BY sec DESC`
    )
    .all(SAMPLE_SEC, start) as { category: string; sec: number }[]
  return rows
}

export function getRanking(range: RangeKey, limit = 10): RankItem[] {
  const start = rangeStartMs(range)
  const rows = db
    .prepare(
      `SELECT appName AS app, COUNT(*) * ? AS sec
       FROM app_usage
       WHERE active = 1 AND sampleTs >= ? AND appName IS NOT NULL
       GROUP BY appName ORDER BY sec DESC LIMIT ?`
    )
    .all(SAMPLE_SEC, start, limit) as { app: string; sec: number }[]
  return rows
}

export function getTrend(days: number): TrendPoint[] {
  const out: TrendPoint[] = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const dStart = new Date(now)
    dStart.setDate(now.getDate() - i)
    const ds = dStart.getTime()
    const de = ds + 24 * 3600 * 1000
    const row = db
      .prepare(
        'SELECT COUNT(*) * ? AS sec FROM app_usage WHERE active = 1 AND sampleTs >= ? AND sampleTs < ?'
      )
      .get(SAMPLE_SEC, ds, de) as { sec: number }

    const pStart = ds - 7 * 24 * 3600 * 1000
    const pEnd = de - 7 * 24 * 3600 * 1000
    const pRow = db
      .prepare(
        'SELECT COUNT(*) * ? AS sec FROM app_usage WHERE active = 1 AND sampleTs >= ? AND sampleTs < ?'
      )
      .get(SAMPLE_SEC, pStart, pEnd) as { sec: number }

    out.push({
      date: dStart.toISOString().slice(0, 10),
      sec: row.sec,
      prevSec: pRow.sec
    })
  }
  return out
}

// ---------- 笔记 & 分组 ----------
export function listGroups(): Group[] {
  return db.prepare('SELECT * FROM groups ORDER BY sort, createdAt').all() as Group[]
}
export function createGroup(name: string, color: string): Group {
  const g: Group = {
    id: crypto.randomUUID(),
    name,
    color,
    sort: Date.now(),
    createdAt: Date.now()
  }
  db.prepare('INSERT INTO groups (id, name, color, sort, createdAt) VALUES (?, ?, ?, ?, ?)').run(
    g.id,
    g.name,
    g.color,
    g.sort,
    g.createdAt
  )
  return g
}
export function updateGroup(id: string, name?: string, color?: string): void {
  db.prepare(
    'UPDATE groups SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?'
  ).run(name ?? null, color ?? null, id)
}
export function deleteGroup(id: string): void {
  db.prepare('DELETE FROM groups WHERE id = ?').run(id)
}

export function listNotes(groupId?: string | null): Note[] {
  if (groupId === undefined) {
    return db
      .prepare('SELECT * FROM notes ORDER BY pinned DESC, updatedAt DESC')
      .all() as Note[]
  }
  return db
    .prepare('SELECT * FROM notes WHERE groupId IS ? ORDER BY pinned DESC, updatedAt DESC')
    .all(groupId ?? null) as Note[]
}
export function getNote(id: string): Note | null {
  const row = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
  return row ?? null
}
export function createNote(groupId: string | null): Note {
  const now = Date.now()
  const n: Note = {
    id: crypto.randomUUID(),
    groupId,
    title: '无标题',
    content: '',
    pinned: 0,
    createdAt: now,
    updatedAt: now
  }
  db.prepare(
    'INSERT INTO notes (id, groupId, title, content, pinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(n.id, n.groupId, n.title, n.content, n.pinned, n.createdAt, n.updatedAt)
  return n
}
export function updateNote(
  id: string,
  patch: Partial<Pick<Note, 'title' | 'content' | 'groupId' | 'pinned'>>
): void {
  const sets: string[] = []
  const args: (string | number | null)[] = []
  if (patch.title !== undefined) {
    sets.push('title = ?')
    args.push(patch.title)
  }
  if (patch.content !== undefined) {
    sets.push('content = ?')
    args.push(patch.content)
  }
  if (patch.groupId !== undefined) {
    sets.push('groupId = ?')
    args.push(patch.groupId)
  }
  if (patch.pinned !== undefined) {
    sets.push('pinned = ?')
    args.push(patch.pinned)
  }
  if (!sets.length) return
  sets.push('updatedAt = ?')
  args.push(Date.now())
  args.push(id)
  db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...args)
}
export function deleteNote(id: string): void {
  db.prepare('DELETE FROM notes WHERE id = ?').run(id)
}

// ---------- 待办 ----------
export function listTodos(includeDone = false): Todo[] {
  if (includeDone) {
    return db.prepare('SELECT * FROM todos ORDER BY done, remindAt IS NULL, remindAt').all() as Todo[]
  }
  return db
    .prepare('SELECT * FROM todos WHERE done = 0 ORDER BY remindAt IS NULL, remindAt')
    .all() as Todo[]
}
export function createTodo(t: Partial<Todo>): Todo {
  const todo: Todo = {
    id: crypto.randomUUID(),
    title: t.title ?? '新待办',
    noteId: t.noteId ?? null,
    done: 0,
    dueAt: t.dueAt ?? null,
    remindAt: t.remindAt ?? null,
    createdAt: Date.now()
  }
  db.prepare(
    'INSERT INTO todos (id, title, noteId, done, dueAt, remindAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(todo.id, todo.title, todo.noteId, todo.done, todo.dueAt, todo.remindAt, todo.createdAt)
  return todo
}
export function updateTodo(id: string, patch: Partial<Todo>): void {
  const sets: string[] = []
  const args: (string | number | null)[] = []
  for (const k of ['title', 'dueAt', 'remindAt', 'noteId'] as const) {
    if (patch[k] !== undefined) {
      sets.push(`${k} = ?`)
      args.push(patch[k] as string | number | null)
    }
  }
  if (patch.done !== undefined) {
    sets.push('done = ?')
    args.push(patch.done)
    if (patch.done) {
      sets.push('notified = 1')
    }
  }
  if (!sets.length) return
  args.push(id)
  db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...args)
}
export function deleteTodo(id: string): void {
  db.prepare('DELETE FROM todos WHERE id = ?').run(id)
}

export function dueReminders(): Todo[] {
  const now = Date.now()
  return db
    .prepare(
      `SELECT * FROM todos WHERE done = 0 AND notified = 0
       AND remindAt IS NOT NULL AND remindAt <= ? ORDER BY remindAt`
    )
    .all(now) as Todo[]
}

export function markNotified(id: string): void {
  db.prepare('UPDATE todos SET notified = 1 WHERE id = ?').run(id)
}
