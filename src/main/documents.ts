import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type OpenDialogOptions,
  type SaveDialogOptions
} from 'electron'
import { access, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { constants } from 'node:fs'
import * as db from './db'
import type {
  DocumentExternalChange,
  DocumentSaveResult,
  MarkdownDocument,
  MarkdownDocumentContent,
  MarkdownWorkspace
} from '../shared/types'

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown'])
const watchers = new Map<string, FSWatcher>()

function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extname(path).toLocaleLowerCase())
}

function normalizeForCompare(path: string): string {
  const normalized = resolve(path)
  return process.platform === 'win32' ? normalized.toLocaleLowerCase() : normalized
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(normalizeForCompare(root), normalizeForCompare(candidate))
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function workspaceForPath(path: string): MarkdownWorkspace | null {
  return (
    db
      .listMarkdownWorkspaces()
      .filter((workspace) => isWithin(workspace.rootPath, path))
      .sort((a, b) => b.rootPath.length - a.rootPath.length)[0] ?? null
  )
}

async function canonicalExisting(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error('仅允许绝对路径')
  return realpath(path)
}

async function assertAuthorizedExisting(path: string): Promise<string> {
  const canonical = await canonicalExisting(path)
  if (!isMarkdownPath(canonical)) throw new Error('仅支持 .md 和 .markdown 文件')
  if (db.getMarkdownDocument(canonical) || workspaceForPath(canonical)) return canonical
  throw new Error('文件不在已授权工作区，也未导入文档库')
}

async function assertAuthorizedDestination(path: string): Promise<string> {
  if (!isAbsolute(path)) throw new Error('仅允许绝对路径')
  if (!isMarkdownPath(path)) throw new Error('文件名必须以 .md 或 .markdown 结尾')
  const canonicalParent = await realpath(dirname(path))
  const destination = join(canonicalParent, basename(path))
  if (!workspaceForPath(destination)) throw new Error('目标路径必须位于已授权工作区内')
  return destination
}

async function canWrite(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

async function describeDocument(path: string, lastOpenedAt = Date.now()): Promise<Omit<MarkdownDocument, 'tags'>> {
  const info = await stat(path)
  const workspace = workspaceForPath(path)
  return {
    path,
    name: basename(path),
    workspaceId: workspace?.id ?? null,
    relativePath: workspace ? relative(workspace.rootPath, path) : null,
    size: info.size,
    mtimeMs: info.mtimeMs,
    lastOpenedAt,
    readOnly: !(await canWrite(path))
  }
}

async function indexFile(path: string, touch = false): Promise<MarkdownDocument> {
  const canonical = await canonicalExisting(path)
  if (!isMarkdownPath(canonical)) throw new Error('仅支持 .md 和 .markdown 文件')
  const existing = db.getMarkdownDocument(canonical)
  const content = await readFile(canonical, 'utf8')
  const metadata = await describeDocument(canonical, touch ? Date.now() : existing?.lastOpenedAt ?? Date.now())
  const document = db.upsertMarkdownDocument(metadata, content)
  if (touch) db.touchMarkdownDocument(canonical)
  return db.getMarkdownDocument(canonical) ?? document
}

async function walkMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      const candidate = join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) await visit(candidate)
      else if (entry.isFile() && isMarkdownPath(candidate)) files.push(candidate)
    }
  }
  await visit(root)
  return files
}

async function scanWorkspace(id: string): Promise<MarkdownDocument[]> {
  const workspace = db.getMarkdownWorkspace(id)
  if (!workspace) throw new Error('工作区不存在')
  const root = await canonicalExisting(workspace.rootPath)
  const files = await walkMarkdownFiles(root)
  const indexed: MarkdownDocument[] = []
  for (const path of files) {
    try {
      indexed.push(await indexFile(path))
    } catch {
      // A single unreadable file must not block the rest of the workspace.
    }
  }
  const found = new Set(indexed.map((document) => normalizeForCompare(document.path)))
  for (const known of db.listMarkdownDocuments(id)) {
    if (!found.has(normalizeForCompare(known.path))) db.removeMarkdownDocument(known.path)
  }
  return db.listMarkdownDocuments(id)
}

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(event.sender) ?? undefined
}

function emitExternalChange(getDocumentWindow: () => BrowserWindow | null, payload: DocumentExternalChange): void {
  const window = getDocumentWindow()
  if (window && !window.isDestroyed()) window.webContents.send('documents:externalChanged', payload)
}

function watchDocument(path: string, getDocumentWindow: () => BrowserWindow | null): void {
  if (watchers.has(path)) return
  try {
    const watcher = watch(path, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      try {
        const info = await stat(path)
        const known = db.getMarkdownDocument(path)
        if (known && Math.abs(known.mtimeMs - info.mtimeMs) <= 0.5) return
        emitExternalChange(getDocumentWindow, { path, mtimeMs: info.mtimeMs, deleted: false })
      } catch {
        emitExternalChange(getDocumentWindow, { path, mtimeMs: null, deleted: true })
      }
    })
    watcher.on('error', () => {
      watcher.close()
      watchers.delete(path)
    })
    watchers.set(path, watcher)
  } catch {
    // Saving still performs an mtime conflict check when native watching is unavailable.
  }
}

async function readDocument(path: string, getDocumentWindow: () => BrowserWindow | null): Promise<MarkdownDocumentContent> {
  const canonical = await assertAuthorizedExisting(path)
  const content = await readFile(canonical, 'utf8')
  await indexFile(canonical, true)
  watchDocument(canonical, getDocumentWindow)
  return { document: db.getMarkdownDocument(canonical)!, content }
}

async function saveDocument(
  path: string,
  content: string,
  expectedMtimeMs: number,
  force: boolean
): Promise<DocumentSaveResult> {
  const canonical = await assertAuthorizedExisting(path)
  const before = await stat(canonical)
  if (!force && Math.abs(before.mtimeMs - expectedMtimeMs) > 0.5) {
    return {
      ok: false,
      conflict: { path: canonical, expectedMtimeMs, actualMtimeMs: before.mtimeMs }
    }
  }
  await writeFile(canonical, content, 'utf8')
  const metadata = await describeDocument(canonical)
  return { ok: true, document: db.upsertMarkdownDocument(metadata, content) }
}

async function chooseSavePath(window: BrowserWindow | undefined, suggestedName: string): Promise<string | null> {
  const options: SaveDialogOptions = {
    title: '另存为 Markdown',
    defaultPath: suggestedName,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
  }
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options)
  return result.canceled || !result.filePath ? null : result.filePath
}

async function showOpenDialog(window: BrowserWindow | undefined, options: OpenDialogOptions) {
  return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options)
}

export function registerDocumentIpc(
  openDocumentWindow: (paths?: string[]) => Promise<void>,
  getDocumentWindow: () => BrowserWindow | null,
  closeDocumentWindow: () => void
): void {
  ipcMain.handle('documents:openWindow', async (_event, paths?: string[]) => openDocumentWindow(paths))
  ipcMain.handle('documents:workspaces', () => db.listMarkdownWorkspaces())
  ipcMain.handle('documents:addWorkspace', async (event) => {
    const result = await showOpenDialog(senderWindow(event), {
      title: '选择 Markdown 工作区',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const rootPath = await canonicalExisting(result.filePaths[0])
    const workspace = db.upsertMarkdownWorkspace(rootPath, basename(rootPath))
    await scanWorkspace(workspace.id)
    return workspace
  })
  ipcMain.handle('documents:removeWorkspace', (_event, id: string) => db.removeMarkdownWorkspace(id))
  ipcMain.handle('documents:scanWorkspace', (_event, id: string) => scanWorkspace(id))
  ipcMain.handle('documents:list', (_event, workspaceId?: string) => db.listMarkdownDocuments(workspaceId))
  ipcMain.handle('documents:recent', (_event, limit?: number) => db.listRecentMarkdownDocuments(limit))
  ipcMain.handle('documents:forget', (_event, path: string) => db.forgetMarkdownDocument(path))
  ipcMain.handle('documents:import', async (event) => {
    const result = await showOpenDialog(senderWindow(event), {
      title: '导入 Markdown 文档',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    })
    if (result.canceled) return []
    const documents: MarkdownDocument[] = []
    for (const path of result.filePaths) documents.push(await indexFile(path, true))
    return documents
  })
  ipcMain.handle('documents:read', (_event, path: string) => readDocument(path, getDocumentWindow))
  ipcMain.handle(
    'documents:save',
    (_event, path: string, content: string, expectedMtimeMs: number, force = false) =>
      saveDocument(path, content, expectedMtimeMs, force)
  )
  ipcMain.handle('documents:saveAs', async (event, path: string, content: string) => {
    const suggested = basename(path || '未命名.md')
    const destination = await chooseSavePath(senderWindow(event), suggested)
    if (!destination) return null
    if (!isMarkdownPath(destination)) throw new Error('文件名必须以 .md 或 .markdown 结尾')
    await writeFile(destination, content, { encoding: 'utf8', flag: 'wx' }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
      await writeFile(destination, content, 'utf8')
    })
    return indexFile(destination, true)
  })
  ipcMain.handle('documents:create', async (_event, workspaceId: string, folderPath?: string) => {
    const workspace = db.getMarkdownWorkspace(workspaceId)
    if (!workspace) throw new Error('工作区不存在')
    const folder = folderPath ? await canonicalExisting(folderPath) : workspace.rootPath
    if (!isWithin(workspace.rootPath, folder)) throw new Error('目标目录不在工作区内')
    await mkdir(folder, { recursive: true })
    let index = 0
    let destination = join(folder, '未命名.md')
    while (true) {
      try {
        await stat(destination)
        index += 1
        destination = join(folder, `未命名 ${index}.md`)
      } catch {
        break
      }
    }
    destination = await assertAuthorizedDestination(destination)
    await writeFile(destination, '# 未命名\n', { encoding: 'utf8', flag: 'wx' })
    return indexFile(destination, true)
  })
  ipcMain.handle('documents:rename', async (_event, path: string, newName: string) => {
    const canonical = await assertAuthorizedExisting(path)
    const safeName = basename(newName.trim())
    if (!safeName || safeName !== newName.trim() || !isMarkdownPath(safeName)) {
      throw new Error('请输入有效的 .md 或 .markdown 文件名')
    }
    const destination = await assertAuthorizedDestination(join(dirname(canonical), safeName))
    watchers.get(canonical)?.close()
    watchers.delete(canonical)
    await rename(canonical, destination)
    const content = await readFile(destination, 'utf8')
    const document = db.moveMarkdownDocumentPath(canonical, await describeDocument(destination), content)
    watchDocument(destination, getDocumentWindow)
    return document
  })
  ipcMain.handle('documents:move', async (event, path: string) => {
    const canonical = await assertAuthorizedExisting(path)
    const workspace = workspaceForPath(canonical)
    if (!workspace) throw new Error('只有工作区内的文件可以移动')
    const result = await showOpenDialog(senderWindow(event), {
      title: '选择目标文件夹',
      defaultPath: workspace.rootPath,
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const folder = await canonicalExisting(result.filePaths[0])
    if (!isWithin(workspace.rootPath, folder)) throw new Error('目标目录必须位于同一工作区')
    const destination = await assertAuthorizedDestination(join(folder, basename(canonical)))
    watchers.get(canonical)?.close()
    watchers.delete(canonical)
    await rename(canonical, destination)
    const content = await readFile(destination, 'utf8')
    const document = db.moveMarkdownDocumentPath(canonical, await describeDocument(destination), content)
    watchDocument(destination, getDocumentWindow)
    return document
  })
  ipcMain.handle('documents:delete', async (_event, path: string) => {
    const canonical = await assertAuthorizedExisting(path)
    await shell.trashItem(canonical)
    watchers.get(canonical)?.close()
    watchers.delete(canonical)
    db.removeMarkdownDocument(canonical)
  })
  ipcMain.handle('documents:search', (_event, query: string) =>
    query.trim() ? db.searchMarkdownDocuments(query.trim()) : []
  )
  ipcMain.handle('documents:setTags', (_event, path: string, tags: string[]) =>
    db.setMarkdownDocumentTags(path, tags)
  )
  ipcMain.handle('documents:getSession', () => db.getDocumentSession())
  ipcMain.handle('documents:setSession', (_event, session) => db.setDocumentSession(session))
  ipcMain.handle('documents:resolveAsset', async (_event, documentPath: string, source: string) => {
    if (/^(data:image\/|blob:)/i.test(source)) return source
    if (/^[a-z][a-z\d+.-]*:/i.test(source)) return ''
    const canonicalDocument = await assertAuthorizedExisting(documentPath)
    let decodedSource = source
    try {
      decodedSource = decodeURIComponent(source)
    } catch {
      return ''
    }
    const candidate = await realpath(resolve(dirname(canonicalDocument), decodedSource))
    const workspace = workspaceForPath(canonicalDocument)
    const allowedRoot = workspace?.rootPath ?? dirname(canonicalDocument)
    if (!isWithin(allowedRoot, candidate)) return ''
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp'
    }
    const mimeType = mimeTypes[extname(candidate).toLocaleLowerCase()]
    if (!mimeType) return ''
    const info = await stat(candidate)
    if (info.size > 10 * 1024 * 1024) return ''
    const bytes = await readFile(candidate)
    return `data:${mimeType};base64,${bytes.toString('base64')}`
  })
  ipcMain.handle('documents:confirmClose', () => closeDocumentWindow())
}

export async function registerExternalDocument(path: string): Promise<MarkdownDocument | null> {
  try {
    return await indexFile(path, true)
  } catch {
    return null
  }
}

export function closeDocumentWatchers(): void {
  for (const watcher of watchers.values()) watcher.close()
  watchers.clear()
}
