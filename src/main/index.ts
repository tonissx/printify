import { app, clipboard, desktopCapturer, screen, ClipboardItem, globalShortcut, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Display } from 'electron'
import type { Format, Prefs, Rect, RecordStart } from '../shared/types'
import { convert } from './ffmpeg'
import { getPrefs, outputDir, setPrefs, stamp } from './storage'
import {
  activeDisplay, closeOverlay, closePill, openOverlay, openPill, overlayInit, pillInit, pillWin, showToast, toastInit
} from './windows'

const SHORTCUT_SHOT = 'Control+PrintScreen'
const SHORTCUT_REC = 'Control+G'

let tray: Tray | null = null
let recording = false

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

function fromSender<T>(map: Map<number, T>, e: Electron.IpcMainInvokeEvent): T | undefined {
  return map.get(e.sender.id)
}

function registerShortcuts(): void {
  const shot = globalShortcut.register(SHORTCUT_SHOT, () => void openOverlay('shot'))
  if (!shot) console.warn(`Não foi possível registrar ${SHORTCUT_SHOT}: outro app (ex.: Lightshot) já usa esse atalho.`)
  const rec = globalShortcut.register(SHORTCUT_REC, () => {
    if (recording) pillWin?.webContents.send('rec:stop')
    else void openOverlay('record')
  })
  if (!rec) console.warn(`Não foi possível registrar ${SHORTCUT_REC}.`)
}

function createTray(): void {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Printify')
  const build = () => Menu.buildFromTemplate([
      { label: 'Capturar área\tCtrl+Print', click: () => void openOverlay('shot') },
      { label: 'Gravar tela\tCtrl+G', click: () => void openOverlay('record') },
      { type: 'separator' },
      {
        label: 'Bordas arredondadas nos prints',
        type: 'checkbox',
        checked: getPrefs().rounded,
        click: (item) => {
          setPrefs({ rounded: item.checked })
          tray?.setContextMenu(build())
        }
      },
      { label: 'Abrir pasta de capturas', click: () => void shell.openPath(outputDir('pictures')) },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() }
    ])
  tray.setContextMenu(build())
}

async function startRecording(display: Display, region: Rect, mic: boolean, format: Format): Promise<void> {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
  const src = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  const start: RecordStart = {
    sourceId: src.id,
    displayId: display.id,
    bounds: display.bounds,
    scaleFactor: display.scaleFactor,
    region,
    mic,
    format
  }
  closeOverlay()
  recording = true
  openPill(start)
}

function registerIpc(): void {
  ipcMain.handle('overlay:ready', (e) => fromSender(overlayInit, e))
  ipcMain.handle('overlay:close', () => closeOverlay())
  ipcMain.handle('prefs:set', (_e, patch: Partial<Prefs>) => void setPrefs(patch))

  ipcMain.handle('shot:save', async (_e, png: Uint8Array, copyOnly: boolean) => {
    const buf = Buffer.from(png)
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([buf], { type: 'image/png' }) })])
    if (copyOnly) {
      closeOverlay()
      showToast({ message: 'Copiado' })
      return
    }
    const path = join(outputDir('pictures'), `${stamp()}.png`)
    writeFileSync(path, buf)
    closeOverlay()
    showToast({ message: 'Salvo e copiado', action: 'Abrir pasta', revealPath: path })
  })

  ipcMain.handle('rec:start', (_e, req: { mic: boolean; format: Format }, region: Rect) => {
    if (activeDisplay) void startRecording(activeDisplay, region, req.mic, req.format)
  })

  ipcMain.handle('pill:ready', (e) => fromSender(pillInit, e))

  ipcMain.handle('rec:save', async (_e, data: Uint8Array, format: Format) => {
    const base = join(outputDir('videos'), stamp())
    const webm = `${base}.webm`
    writeFileSync(webm, Buffer.from(data))
    recording = false
    closePill()
    showToast({ message: 'Salvo', action: 'Abrir pasta', revealPath: webm })
    try {
      const out = await convert(webm, `${base}.${format}`, format)
      rmSync(webm, { force: true })
      showToast({ message: `${format.toUpperCase()} pronto`, action: 'Abrir pasta', revealPath: out })
    } catch (err) {
      console.error('Conversão falhou', err)
      showToast({
        message: `Falha ao converter para ${format.toUpperCase()}. O WebM foi mantido.`,
        tone: 'neutral',
        action: 'Abrir pasta',
        revealPath: webm
      })
    }
  })

  ipcMain.handle('rec:cancel', (_e, reason?: string) => {
    recording = false
    closePill()
    if (reason) showToast({ message: `Não foi possível gravar: ${reason}`, tone: 'neutral' })
  })

  ipcMain.handle('toast:ready', (e) => fromSender(toastInit, e))
  ipcMain.handle('toast:reveal', (_e, path: string) => shell.showItemInFolder(path))
}

void app.whenReady().then(() => {
  registerIpc()
  registerShortcuts()
  createTray()
  // Atalho de desenvolvimento: PRINTIFY_OPEN=shot|record abre a captura já na inicialização.
  const open = process.env['PRINTIFY_OPEN']
  if (open === 'shot' || open === 'record') void openOverlay(open)
  if (open === 'record-auto') {
    // Teste sem cliques: grava a tela principal por 4 s e salva.
    const d = screen.getPrimaryDisplay()
    void startRecording(d, { x: 0, y: 0, width: Math.min(800, d.bounds.width), height: Math.min(450, d.bounds.height) }, false, 'mp4')
    setTimeout(() => pillWin?.webContents.send('rec:stop'), 4000)
  }
})

// App de bandeja: continua rodando sem janelas.
app.on('window-all-closed', () => {})
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  tray?.destroy()
})
