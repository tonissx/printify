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
  /** OCR local de um PNG (recorte da seleção). */
  ocr(png: Uint8Array): Promise<OcrResult>
  /** Copia texto para a área de transferência, fecha a seleção e avisa. */
  copyText(text: string): Promise<void>
  libSearch(query: string): Promise<CaptureHit[]>
  libStats(): Promise<LibraryStats>
  libOpen(path: string): Promise<void>
  libReveal(path: string): Promise<void>
  libCopyImage(path: string): Promise<void>
}

export interface OcrWord {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface OcrLine {
  text: string
  words: OcrWord[]
}

/** Resultado do OCR. As caixas estão em pixels da imagem enviada. */
export interface OcrResult {
  text: string
  lines: OcrLine[]
}

export interface CaptureHit {
  path: string
  name: string
  mtime: number
  snippet: string
  /** Miniatura em data URL (vazia se o arquivo não abriu). */
  thumb: string
}

export interface LibraryStats {
  total: number
  indexed: number
  pending: number
}
