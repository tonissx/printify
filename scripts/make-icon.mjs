// Gera resources/icon.png (256px): moldura de área em branco sobre fundo ink.
import { createCanvas, Path2D } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'

const size = 256
const c = createCanvas(size, size)
const g = c.getContext('2d')
g.fillStyle = '#17181a'
g.beginPath()
g.roundRect(0, 0, size, size, 56)
g.fill()
g.scale(size / 16, size / 16)
g.translate(0, 0)
g.strokeStyle = '#ffffff'
g.lineWidth = 1.5
g.lineCap = 'round'
g.lineJoin = 'round'
// mesmo desenho do ícone "area" do design system, centralizado com folga
g.save()
g.translate(2, 2)
g.scale(0.75, 0.75)
g.stroke(new Path2D('M2.5 5V3.5a1 1 0 0 1 1-1H5M11 2.5h1.5a1 1 0 0 1 1 1V5M13.5 11v1.5a1 1 0 0 1-1 1H11M5 13.5H3.5a1 1 0 0 1-1-1V11'))
g.restore()
writeFileSync(new URL('../resources/icon.png', import.meta.url), c.toBuffer('image/png'))
console.log('icon.png gerado')
