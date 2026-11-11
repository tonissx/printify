import { createCanvas as mk } from '@napi-rs/canvas'

const createCanvas = (w: number, h: number) => mk(w, h)
import { describe, expect, it } from 'vitest'
import { applyRoundedMask, renderCapture } from '../src/renderer/lib/roundedCrop'

function source(w: number, h: number) {
  const c = createCanvas(w, h)
  const g = c.getContext('2d')
  g.fillStyle = '#ff0000'
  g.fillRect(0, 0, w, h)
  return c
}

const alphaAt = (c: ReturnType<typeof createCanvas>, x: number, y: number) =>
  c.getContext('2d').getImageData(x, y, 1, 1).data[3]

describe('roundedCrop', () => {
  it('deixa os cantos transparentes e o centro opaco', () => {
    const out = createCanvas(10, 10)
    renderCapture(out as never, source(200, 100), { x: 20, y: 10, width: 120, height: 60 }, 12)
    expect(out.width).toBe(120)
    expect(out.height).toBe(60)
    expect(alphaAt(out, 0, 0)).toBe(0)
    expect(alphaAt(out, 119, 0)).toBe(0)
    expect(alphaAt(out, 0, 59)).toBe(0)
    expect(alphaAt(out, 119, 59)).toBe(0)
    expect(alphaAt(out, 60, 30)).toBe(255)
    // borda reta, longe dos cantos, continua opaca
    expect(alphaAt(out, 60, 0)).toBe(255)
  })

  it('raio maior escala o canto (DPI 2x)', () => {
    const a = createCanvas(100, 100)
    const b = createCanvas(100, 100)
    renderCapture(a as never, source(100, 100), { x: 0, y: 0, width: 100, height: 100 }, 12)
    renderCapture(b as never, source(100, 100), { x: 0, y: 0, width: 100, height: 100 }, 24)
    // (4,4) fica fora do canto de raio 24 (transparente) mas dentro do de raio 12 (opaco)
    expect(alphaAt(a, 4, 4)).toBe(255)
    expect(alphaAt(b, 4, 4)).toBe(0)
  })

  it('limita o raio à metade do menor lado', () => {
    const c = createCanvas(20, 20)
    c.getContext('2d').fillStyle = '#000'
    c.getContext('2d').fillRect(0, 0, 20, 20)
    expect(() => applyRoundedMask(c.getContext('2d') as never, 20, 20, 999)).not.toThrow()
    expect(alphaAt(c, 10, 10)).toBe(255)
  })
})
