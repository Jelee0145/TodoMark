import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerExternalDocument } from './documents'

let documentWindow: BrowserWindow | null = null

function loadDocumentRoute(win: BrowserWindow): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/documents/read`)
  } else {
    const fileUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href
    win.loadURL(`${fileUrl}#/documents/read`)
  }
}

function focusWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function sendPaths(win: BrowserWindow, paths: string[]): void {
  const send = () => win.webContents.send('documents:openPaths', paths)
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', () => setTimeout(send, 250))
  else send()
}

function createDocumentWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    roundedCorners: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    title: 'TodoMark 文档',
    icon: join(process.resourcesPath, 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  documentWindow = win
  win.on('ready-to-show', () => focusWindow(win))
  win.on('close', (event) => {
    event.preventDefault()
    win.webContents.send('documents:flushRequested')
  })
  win.on('closed', () => {
    if (documentWindow === win) documentWindow = null
  })
  const syncMaximize = () => win.webContents.send('window:maximizeChanged', win.isMaximized())
  win.on('maximize', syncMaximize)
  win.on('unmaximize', syncMaximize)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })
  loadDocumentRoute(win)
  return win
}

export async function openDocumentWindow(paths: string[] = []): Promise<void> {
  const registeredPaths: string[] = []
  for (const path of paths) {
    const document = await registerExternalDocument(path)
    if (document) registeredPaths.push(document.path)
  }
  const win = documentWindow && !documentWindow.isDestroyed() ? documentWindow : createDocumentWindow()
  focusWindow(win)
  if (registeredPaths.length) sendPaths(win, registeredPaths)
}

export function getDocumentWindow(): BrowserWindow | null {
  return documentWindow && !documentWindow.isDestroyed() ? documentWindow : null
}

export function closeDocumentWindow(): void {
  if (documentWindow && !documentWindow.isDestroyed()) documentWindow.destroy()
  documentWindow = null
}
