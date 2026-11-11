import type { Rect } from '../../shared/types'

/** Subconjunto do CanvasRenderingContext2D que usamos (também implementado por @napi-rs/canvas nos testes). */
export interface Ctx2D {
  save(): void
  restore(): void
  beginPath(): void
  fill(): void
  roundRect(x: number, y: number, w: number, h: number, r: number): void
  drawImage(image: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void
  globalCompositeOperation: GlobalCompositeOperation | string
  fillStyle: string | CanvasGradient | CanvasPattern
}

/**
 * Apaga tudo fora de um retângulo arredondado `w × h`, deixando os cantos transparentes.
 * Usa `destination-in`: o que já foi desenhado só sobrevive dentro do formato.
 */
export function applyRoundedMask(ctx: Ctx2D, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, r)
  ctx.fill()
  ctx.restore()
}

export interface SizableCanvas {
  width: number
  height: number
  getContext(type: '2d'): any
}

/**
 * Recorta `crop` (em pixels físicos) de `image` para `canvas`, deixa o chamador desenhar por cima
 * (anotações) e aplica o raio nos cantos.
 */
export function renderCapture(
  canvas: SizableCanvas,
  image: unknown,
  crop: Rect,
  radius: number,
  draw?: (ctx: Ctx2D) => void
): void {
  const w = Math.max(1, Math.round(crop.width))
  const h = Math.max(1, Math.round(crop.height))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d') as Ctx2D
  ctx.drawImage(image, Math.round(crop.x), Math.round(crop.y), w, h, 0, 0, w, h)
  draw?.(ctx)
  applyRoundedMask(ctx, w, h, radius)
}
