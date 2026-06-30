import { ipcMain, BrowserWindow } from 'electron'

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

// 窗口控制始终作用于发起调用的窗口，支持主窗口、文档窗口和便签窗口共用 preload。
export function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', (event) => {
    senderWindow(event)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = senderWindow(event)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  ipcMain.handle('window:close', (event) => {
    senderWindow(event)?.close()
  })

  ipcMain.handle('window:isMaximized', (event) => {
    return senderWindow(event)?.isMaximized() ?? false
  })
}
