import { BrowserWindow, desktopCapturer, nativeTheme, screen, type Display } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Mode, OverlayInit, Rect, RecordStart, ToastInit } from '../shared/types'
import { getPrefs } from './storage'

const webPreferences = () => ({
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  sandbox: true,
  backgroundThrottling: false
})

function load(win: BrowserWindow, route: string): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${route}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${route}` })
  }
}

function floating(rect: Rect, extra: Electron.BrowserWindowConstructorOptions = {}): BrowserWindow {
  const win = new BrowserWindow({
    ...rect,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: webPreferences(),
    ...extra
  })
  if (process.env['PRINTIFY_OPEN']) {
    win.webContents.on('console-message', (e: any) => console.log('[renderer]', e.message ?? e))
  }
  return win
}

export let overlayWin: BrowserWindow | null = null
export let pillWin: BrowserWindow | null = null
export const overlayInit = new Map<number, OverlayInit>()
export const pillInit = new Map<number, RecordStart>()
export const toastInit = new Map<number, ToastInit>()
export let activeDisplay: Display | null = null

export const isBusy = (): boolean => overlayWin !== null || pillWin !== null

async function freeze(display: Display): Promise<string> {
  // PRINTIFY_FAKE_SHOT=<png>: usa essa imagem no lugar da tela (teste automatizado da seleção).
  const fake = process.env['PRINTIFY_FAKE_SHOT']
  if (fake) return `data:image/png;base64,${readFileSync(fake).toString('base64')}`
  const { width, height } = display.size
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * display.scaleFactor), height: Math.round(height * display.scaleFactor) }
  })
  const src = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  return src.thumbnail.toDataURL()
}

export async function openOverlay(mode: Mode): Promise<void> {
  if (isBusy()) return
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  activeDisplay = display
  // Marca como ocupado já, antes do await da captura (evita duplo disparo do atalho).
  const win = floating(display.bounds)
  overlayWin = win
  const wcId = win.webContents.id
  const image = mode === 'shot' ? await freeze(display) : undefined

  overlayInit.set(wcId, {
    mode,
    bounds: display.bounds,
    scaleFactor: display.scaleFactor,
    image,
    prefs: getPrefs()
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.once('ready-to-show', () => {
    // O Windows pode limitar a janela à área útil (sem a barra de tarefas): força o tamanho do monitor inteiro.
    win.setBounds(display.bounds)
    win.show()
    win.setBounds(display.bounds)
    win.focus()
    if (process.env['PRINTIFY_OPEN']) console.log('overlay bounds', JSON.stringify(win.getBounds()), JSON.stringify(display.bounds))
  })
  win.on('closed', () => {
    overlayInit.delete(wcId)
    if (overlayWin === win) overlayWin = null
  })
  load(win, 'overlay')
}

export function closeOverlay(): void {
  overlayWin?.close()
}

const PILL = { width: 220, height: 64 }

export function openPill(start: RecordStart): void {
  const { bounds } = start
  const win = floating(
    { x: bounds.x + bounds.width - PILL.width - 12, y: bounds.y + 12, ...PILL },
    { focusable: false }
  )
  pillWin = win
  const wcId = win.webContents.id
  pillInit.set(wcId, start)
  // Fora da própria gravação.
  win.setContentProtection(true)
  win.setAlwaysOnTop(true, 'screen-saver')

  const ses = win.webContents.session
  // Só esta janela (local, sem conteúdo remoto) pode capturar tela e microfone.
  const allowed = (p: string) => p === 'media' || p === 'display-capture'
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed(permission)))
  ses.setPermissionCheckHandler((_wc, permission) => allowed(permission))

  win.once('ready-to-show', () => win.showInactive())
  win.on('closed', () => {
    pillInit.delete(wcId)
    if (pillWin === win) pillWin = null
  })
  load(win, 'pill')
}

export function closePill(): void {
  pillWin?.close()
}

const TOAST = { width: 380, height: 72 }

let toastWin: BrowserWindow | null = null

export function showToast(init: ToastInit): void {
  toastWin?.close()
  const display = activeDisplay ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  // workArea exclui a barra de tarefas; bounds a incluiria e o aviso ficaria meio escondido.
  const area = display.workArea
  const win = floating(
    {
      x: area.x + Math.round((area.width - TOAST.width) / 2),
      y: area.y + area.height - TOAST.height - 12,
      ...TOAST
    },
    { focusable: false }
  )
  toastWin = win
  const wcId = win.webContents.id
  toastInit.set(wcId, init)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.once('ready-to-show', () => win.showInactive())
  win.on('closed', () => {
    toastInit.delete(wcId)
    if (toastWin === win) toastWin = null
  })
  load(win, 'toast')
  setTimeout(() => !win.isDestroyed() && win.close(), init.action ? 6000 : 2400)
}

export let libraryWin: BrowserWindow | null = null

/** Janela comum (com moldura) para buscar nas capturas salvas. Só existe uma. */
export function openLibrary(): void {
  if (libraryWin && !libraryWin.isDestroyed()) {
    if (libraryWin.isMinimized()) libraryWin.restore()
    libraryWin.show()
    libraryWin.focus()
    return
  }
  const win = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 640,
    minHeight: 420,
    title: 'Printify · Capturas',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111214' : '#f6f6f3',
    autoHideMenuBar: true,
    show: false,
    webPreferences: webPreferences()
  })
  libraryWin = win
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (libraryWin === win) libraryWin = null
  })
  load(win, 'library')
}
