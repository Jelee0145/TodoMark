import { app, BrowserWindow, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'node:path'
import { initDatabase } from './db'
import { startTracker } from './usage-tracker'
import { startNotifier, stopNotifier } from './notifications'
import { registerIpc } from './ipc'
import { registerWindowIpc } from './window-ipc'
import { closeStickyNoteWindows, registerStickyNoteIpc } from './sticky-notes'
import type { ToastPayload } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
}

function sendWhenReady(channel: string, payload: ToastPayload): void {
  if (!mainWindow) return
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send(channel, payload)
    })
    return
  }
  mainWindow.webContents.send(channel, payload)
}

function openTodoReminder(payload: ToastPayload): void {
  if (!payload.todoId || !mainWindow) return
  showMainWindow()
  mainWindow.focus()
  sendWhenReady('todos:open', payload)
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    frame: false,
    roundedCorners: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    title: 'NOTE ONE',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', showMainWindow)
  mainWindow.webContents.once('did-finish-load', showMainWindow)
  setTimeout(showMainWindow, 1500)

  // 最大化状态变化 → 通知渲染层更新按钮图标
  const syncMaximize = () => {
    mainWindow?.webContents.send('window:maximizeChanged', mainWindow?.isMaximized() ?? false)
  }
  mainWindow.on('maximize', syncMaximize)
  mainWindow.on('unmaximize', syncMaximize)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 关闭按钮 = 最小化到托盘（保留常驻）
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  return mainWindow
}

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(img)
  tray.setToolTip('NOTE ONE')
  const menu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        showMainWindow()
        mainWindow?.focus()
      }
    },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      showMainWindow()
      mainWindow?.focus()
    }
  })
}

// 单实例锁
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      showMainWindow()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    const userDataDir = app.getPath('userData')
    const dbPath = join(userDataDir, 'timemanager.db')
    initDatabase(dbPath)
    registerIpc()
    registerStickyNoteIpc(() => mainWindow)
    const win = createWindow()
    registerWindowIpc(win)
    createTray()
    startTracker()
    startNotifier(
      (payload: ToastPayload) => {
        mainWindow?.webContents.send('toast:show', payload)
      },
      openTodoReminder
    )

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const w = createWindow()
        registerWindowIpc(w)
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 托盘常驻，不退出
  }
})

app.on('before-quit', () => {
  isQuitting = true
  closeStickyNoteWindows()
  stopNotifier()
})
