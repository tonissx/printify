export type Mode = 'shot' | 'record'
export type Format = 'mp4' | 'gif'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Prefs {
  mic: boolean
  countdown: boolean
  format: Format
  /** Cantos arredondados no print salvo (RADIUS_PX). Desligado por padrão. */
  rounded: boolean
}

export const DEFAULT_PREFS: Prefs = { mic: false, countdown: false, format: 'mp4', rounded: false }

/** Raio dos cantos quando `rounded` está ligado, em px lógicos. */
export const RADIUS_PX = 12

export interface OverlayInit {
  mode: Mode
  bounds: Rect
  scaleFactor: number
  /** Print congelado da tela (data URL PNG), só no modo `shot`. */
  image?: string
  prefs: Prefs
}

export interface RecordStart {
  displayId: number
  bounds: Rect
  scaleFactor: number
  /** Região escolhida, em px lógicos relativos à tela. */
  region: Rect
  mic: boolean
  format: Format
  /** Id da fonte de captura da tela (desktopCapturer). */
  sourceId: string
}

export interface ToastInit {
  message: string
  tone?: 'ok' | 'neutral'
  action?: string
  /** Caminho a revelar no Explorer quando a ação for clicada. */
  revealPath?: string
}

/** API exposta ao renderer pelo preload. */
export interface PrintifyApi {
  overlayReady(): Promise<OverlayInit>
  saveShot(png: Uint8Array, copyOnly: boolean): Promise<void>
  startRecording(req: { mic: boolean; format: Format }, region: Rect): Promise<void>
  setPrefs(p: Partial<Prefs>): Promise<void>
  closeOverlay(): Promise<void>
  pillReady(): Promise<RecordStart>
  onStopRequest(cb: () => void): void
  saveRecording(data: Uint8Array, format: Format): Promise<void>
  cancelRecording(reason?: string): Promise<void>
  toastReady(): Promise<ToastInit>
  revealPath(path: string): Promise<void>
}
