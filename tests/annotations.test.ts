import { describe, expect, it } from 'vitest'
import { hitTest, hits, translate, type Annotation } from '../src/renderer/lib/annotations'

const line: Annotation = { kind: 'line', from: { x: 0, y: 0 }, to: { x: 100, y: 0 } }
const rect: Annotation = { kind: 'rect', from: { x: 10, y: 10 }, to: { x: 110, y: 60 } }
const mark: Annotation = { kind: 'highlight', from: { x: 0, y: 100 }, to: { x: 200, y: 100 } }
const pen: Annotation = { kind: 'pen', points: [{ x: 0, y: 200 }, { x: 50, y: 200 }, { x: 50, y: 250 }] }

describe('seleção de anotações', () => {
  it('acerta linha, contorno de retângulo, marca-texto e traço de caneta', () => {
    expect(hits(line, { x: 50, y: 4 })).toBe(true)
    expect(hits(line, { x: 50, y: 30 })).toBe(false)
    expect(hits(rect, { x: 60, y: 10 })).toBe(true) // borda de cima
    expect(hits(rect, { x: 60, y: 35 })).toBe(false) // interior vazio
    expect(hits(mark, { x: 100, y: 106 })).toBe(true)
    expect(hits(mark, { x: 100, y: 130 })).toBe(false)
    expect(hits(pen, { x: 50, y: 230 })).toBe(true)
  })

  it('retorna a anotação mais acima quando há sobreposição', () => {
    const top: Annotation = { kind: 'line', from: { x: 0, y: 2 }, to: { x: 100, y: 2 } }
    expect(hitTest([line, top], { x: 50, y: 1 })).toBe(1)
    expect(hitTest([line, top], { x: 500, y: 500 })).toBe(-1)
  })

  it('translate move todos os pontos sem alterar o original', () => {
    const moved = translate(rect, 5, -3)
    expect(moved).toEqual({ kind: 'rect', from: { x: 15, y: 7 }, to: { x: 115, y: 57 } })
    expect((rect as { from: { x: number } }).from.x).toBe(10)
    const p = translate(pen, 1, 1)
    expect(p.kind === 'pen' && p.points[2]).toEqual({ x: 51, y: 251 })
  })
})
