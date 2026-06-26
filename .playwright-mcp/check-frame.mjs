import { createRequire } from 'module'
const require = createRequire('file:///C:/Users/35992/AppData/Roaming/npm/node_modules/playwright/package.json')
const { _electron: electron } = require('playwright')
import path from 'path'

async function main() {
  const app = await electron.launch({
    executablePath: path.resolve('D:/project/时间管理/node_modules/electron/dist/electron.exe'),
    args: [path.resolve('D:/project/时间管理/out/main/index.js')],
    cwd: 'D:/project/时间管理'
  })
  const p = await app.firstWindow()
  await p.waitForLoadState('networkidle')
  await p.waitForTimeout(600)

  const dir = 'D:/project/时间管理/.playwright-mcp'
  await p.screenshot({ path: path.join(dir, 'frame_check.png'), fullPage: false })

  // 检测窗口顶部像素：如果最顶行存在非页面元素的原生控制按钮，说明 frame 未生效
  const info = await p.evaluate(() => {
    const header = document.querySelector('header')
    const topbar = document.querySelector('[data-topbar]')
    const root = document.querySelector('#root')
    return {
      headerRect: header?.getBoundingClientRect(),
      topbarData: topbar?.getBoundingClientRect(),
      rootRect: root?.getBoundingClientRect(),
      bodyMargin: getComputedStyle(document.body).margin,
      htmlMargin: getComputedStyle(document.documentElement).margin,
      screenAvailHeight: window.screen.availHeight,
      innerHeight: window.innerHeight,
      outerHeight: window.outerHeight,
      screenY: window.screenY
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await app.close()
}

main().catch(e => { console.error(e); process.exit(1) })
