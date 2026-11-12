import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdateState = { status: 'idle' } | { status: 'downloading'; version: string } | { status: 'ready'; version: string }

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

let state: UpdateState = { status: 'idle' }

export const updateState = (): UpdateState => state

/** Instala agora: fecha o app, roda o instalador em silêncio e reabre o Printify. */
export function installUpdateNow(): void {
  if (state.status === 'ready') autoUpdater.quitAndInstall(true, true)
}

/**
 * Atualização automática pelas releases do GitHub: confere ao abrir e a cada 6 h, baixa sozinha e instala
 * quando o app é fechado (ou na hora, pelo item da bandeja). Só roda no app instalado.
 */
export function startUpdater(onChange: (s: UpdateState) => void, onReady: (version: string) => void): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  const set = (s: UpdateState): void => {
    state = s
    onChange(s)
  }
  autoUpdater.on('update-available', (i) => set({ status: 'downloading', version: i.version }))
  autoUpdater.on('update-not-available', () => set({ status: 'idle' }))
  autoUpdater.on('update-downloaded', (i) => {
    set({ status: 'ready', version: i.version })
    onReady(i.version)
  })
  autoUpdater.on('error', (e) => {
    console.warn('Atualização falhou:', e?.message ?? e)
    if (state.status === 'downloading') set({ status: 'idle' })
  })

  const check = (): void => {
    if (state.status === 'ready') return
    autoUpdater.checkForUpdates().catch(() => {})
  }
  setTimeout(check, 15_000)
  setInterval(check, CHECK_EVERY_MS)
}
