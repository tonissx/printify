import { createCanvas } from '@napi-rs/canvas'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { configureOcr, recognize, shutdownOcr } from '../src/main/ocr'
import { findSensitive } from '../src/shared/sensitive'

const root = join(__dirname, '..')
configureOcr({
  workerPath: join(root, 'node_modules/tesseract.js/src/worker-script/node/index.js'),
  langPath: join(root, 'resources/tessdata')
})

/** PNG branco com linhas de texto preto, no tamanho de uma interface comum. */
function textImage(lines: string[], size = 28): Buffer {
  const c = createCanvas(900, 40 + lines.length * (size + 22))
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#111111'
  g.font = `${size}px Arial`
  lines.forEach((l, i) => g.fillText(l, 24, 50 + i * (size + 22)))
  return c.toBuffer('image/png')
}

afterAll(() => shutdownOcr())

describe('OCR local (tesseract.js, sem rede)', () => {
  it('lê texto em português com acento', async () => {
    const r = await recognize(textImage(['Relatório de conciliação bancária', 'Erro ao conectar no servidor']))
    expect(r.text.toLowerCase()).toContain('conciliação')
    expect(r.text.toLowerCase()).toContain('servidor')
    expect(r.lines.length).toBeGreaterThanOrEqual(2)
    expect(r.lines[0].words[0].x1).toBeGreaterThan(r.lines[0].words[0].x0)
  }, 60_000)

  it('devolve caixas que permitem localizar o dado sensível na imagem', async () => {
    const r = await recognize(textImage(['Contato: ana.silva@empresa.com.br', 'CPF 529.982.247-25']))
    const found = findSensitive(r.lines)
    const kinds = found.map((f) => f.kind)
    expect(kinds).toContain('email')
    expect(kinds).toContain('cpf')
    const email = found.find((f) => f.kind === 'email')!
    // o e-mail está na primeira linha, à direita de "Contato:" (x > 150) e perto do topo (y < 90)
    expect(email.box.x0).toBeGreaterThan(100)
    expect(email.box.y1).toBeLessThan(90)
  }, 60_000)

  it('imagem sem texto devolve vazio', async () => {
    const c = createCanvas(300, 120)
    c.getContext('2d').fillStyle = '#fff'
    c.getContext('2d').fillRect(0, 0, 300, 120)
    const r = await recognize(c.toBuffer('image/png'))
    expect(r.text).toBe('')
    expect(r.lines).toEqual([])
  }, 60_000)
})
