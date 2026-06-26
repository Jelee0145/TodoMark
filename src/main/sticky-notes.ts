import { BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'

const stickyWindows = new Map<string, BrowserWindow>()

function stickyRoute(noteId: string): string {
  return `/sticky-note/${encodeURIComponent(noteId)}`
}

function loadStickyRoute(win: BrowserWindow, noteId: string): void {
  const route = stickyRoute(noteId)
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${route}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
  }
}

function sendWhenReady(win: BrowserWindow, channel: string, payload: unknown): void {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    })
    return
  }
  win.webContents.send(channel, payload)
}

function focusWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function openStickyNote(noteId: string): void {
  const existing = stickyWindows.get(noteId)
  if (existing && !existing.isDestroyed()) {
    focusWindow(existing)
    return
  }

  const win = new BrowserWindow({
    width: 360,
    height: 440,
    minWidth: 280,
    minHeight: 260,
    show: false,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    roundedCorners: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    title: 'NOTE ONE Sticky Note',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  stickyWindows.set(noteId, win)
  win.setAlwaysOnTop(true)
  win.on('ready-to-show', () => win.showInactive())
  win.on('closed', () => {
    if (stickyWindows.get(noteId) === win) stickyWindows.delete(noteId)
  })
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadStickyRoute(win, noteId)
}

export function registerStickyNoteIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('stickyNotes:open', (_event, noteId: string) => {
    openStickyNote(noteId)
  })

  ipcMain.handle('stickyNotes:close', (_event, noteId: string) => {
    const win = stickyWindows.get(noteId)
    if (win && !win.isDestroyed()) win.close()
  })

  ipcMain.handle('stickyNotes:edit', (_event, noteId: string) => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return
    focusWindow(win)
    sendWhenReady(win, 'notes:open', { noteId })
  })

  ipcMain.handle('stickyNotes:setAlwaysOnTop', (_event, noteId: string, pinned: boolean) => {
    const win = stickyWindows.get(noteId)
    if (!win || win.isDestroyed()) return false
    win.setAlwaysOnTop(pinned)
    return win.isAlwaysOnTop()
  })
}

export function closeStickyNoteWindows(): void {
  for (const win of Array.from(stickyWindows.values())) {
    if (!win.isDestroyed()) win.close()
  }
  stickyWindows.clear()
}
