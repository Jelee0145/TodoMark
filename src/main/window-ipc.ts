import { ipcMain, BrowserWindow } from 'electron'

// 窗口控制：最小化/最大化切换/关闭（关闭=最小化到托盘）
export function registerWindowIpc(win: BrowserWindow): void {
  ipcMain.handle('window:minimize', () => {
    win.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  ipcMain.handle('window:close', () => {
    win.hide()
  })

  ipcMain.handle('window:isMaximized', () => {
    return win.isMaximized()
  })
}
