export interface Pt {
  x: number
  y: number
}

export type Annotation =
  | { kind: 'pen'; points: Pt[] }
  | { kind: 'arrow'; from: Pt; to: Pt }
  | { kind: 'line'; from: Pt; to: Pt }
  | { kind: 'rect'; from: Pt; to: Pt }
  | { kind: 'highlight'; from: Pt; to: Pt }
  | { kind: 'redact'; from: Pt; to: Pt }
  | { kind: 'text'; at: Pt; text: string }

export const LINE_WIDTH = 3
export const FONT_SIZE = 18
export const HIGHLIGHT_WIDTH = 18
export const HIGHLIGHT_COLOR = 'rgba(255, 214, 0, 0.4)'

/**
 * Desenha anotações. As coordenadas são lógicas (relativas à tela); `scale` converte para pixels do
 * canvas e `ox/oy` é a origem do recorte, em coordenadas lógicas.
 */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  anns: Annotation[],
  color: string,
  scale = 1,
  ox = 0,
  oy = 0
): void {
  const px = (p: Pt) => ({ x: (p.x - ox) * scale, y: (p.y - oy) * scale })
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = LINE_WIDTH * scale

  for (const a of anns) {
    if (a.kind === 'pen') {
      if (a.points.length === 0) continue
      ctx.beginPath()
      const [first, ...rest] = a.points.map(px)
      ctx.moveTo(first.x, first.y)
      if (rest.length === 0) ctx.lineTo(first.x + 0.01, first.y)
      for (const p of rest) ctx.lineTo(p.x, p.y)
      ctx.stroke()
    } else if (a.kind === 'redact') {
      // Tarja 100% opaca (nunca desfoque): o que está embaixo não pode ser recuperado do PNG.
      const f = px(a.from)
      const t = px(a.to)
      ctx.save()
      ctx.fillStyle = '#000'
      ctx.fillRect(Math.min(f.x, t.x), Math.min(f.y, t.y), Math.abs(t.x - f.x), Math.abs(t.y - f.y))
      ctx.restore()
    } else if (a.kind === 'highlight') {
      const f = px(a.from)
      const t = px(a.to)
      ctx.save()
      ctx.strokeStyle = HIGHLIGHT_COLOR
      ctx.lineWidth = HIGHLIGHT_WIDTH * scale
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.moveTo(f.x, f.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
      ctx.restore()
    } else if (a.kind === 'line') {
      const f = px(a.from)
      const t = px(a.to)
      ctx.beginPath()
      ctx.moveTo(f.x, f.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    } else if (a.kind === 'rect') {
      const f = px(a.from)
      const t = px(a.to)
      ctx.strokeRect(Math.min(f.x, t.x), Math.min(f.y, t.y), Math.abs(t.x - f.x), Math.abs(t.y - f.y))
    } else if (a.kind === 'arrow') {
      const f = px(a.from)
      const t = px(a.to)
      const ang = Math.atan2(t.y - f.y, t.x - f.x)
      const head = 14 * scale
      ctx.beginPath()
      ctx.moveTo(f.x, f.y)
      ctx.lineTo(t.x, t.y)
      ctx.moveTo(t.x - head * Math.cos(ang - Math.PI / 6), t.y - head * Math.sin(ang - Math.PI / 6))
      ctx.lineTo(t.x, t.y)
      ctx.lineTo(t.x - head * Math.cos(ang + Math.PI / 6), t.y - head * Math.sin(ang + Math.PI / 6))
      ctx.stroke()
    } else {
      const p = px(a.at)
      ctx.font = `600 ${FONT_SIZE * scale}px Geist, "Segoe UI", system-ui, sans-serif`
      ctx.textBaseline = 'top'
      ctx.lineWidth = 4 * scale
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.strokeText(a.text, p.x, p.y)
      ctx.fillText(a.text, p.x, p.y)
      ctx.strokeStyle = color
      ctx.lineWidth = LINE_WIDTH * scale
    }
  }
  ctx.restore()
}

// ---------- Seleção e movimento ----------

export const HIT_TOLERANCE = 8

let measureCtx: CanvasRenderingContext2D | null = null
function textSize(text: string): { width: number; height: number } {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return { width: text.length * FONT_SIZE * 0.6, height: FONT_SIZE * 1.3 }
  measureCtx.font = `600 ${FONT_SIZE}px Geist, "Segoe UI", system-ui, sans-serif`
  return { width: measureCtx.measureText(text).width, height: FONT_SIZE * 1.3 }
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Retângulo que envolve a anotação (coordenadas lógicas). */
export function boundsOf(a: Annotation): { x: number; y: number; width: number; height: number } {
  let pts: Pt[]
  let pad = LINE_WIDTH / 2
  if (a.kind === 'pen') pts = a.points
  else if (a.kind === 'text') {
    const s = textSize(a.text)
    pts = [a.at, { x: a.at.x + s.width, y: a.at.y + s.height }]
  } else {
    pts = [a.from, a.to]
    if (a.kind === 'highlight') pad = HIGHLIGHT_WIDTH / 2
  }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x = Math.min(...xs) - pad
  const y = Math.min(...ys) - pad
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y }
}

/** A anotação está sob o ponto `p`? Linhas e contornos aceitam folga; texto e marca-texto contam a área toda. */
export function hits(a: Annotation, p: Pt, tol = HIT_TOLERANCE): boolean {
  switch (a.kind) {
    case 'pen': {
      if (a.points.length === 1) return Math.hypot(p.x - a.points[0].x, p.y - a.points[0].y) <= tol
      return a.points.some((q, i) => i > 0 && distToSegment(p, a.points[i - 1], q) <= tol)
    }
    case 'line':
    case 'arrow':
      return distToSegment(p, a.from, a.to) <= tol
    case 'highlight':
      return distToSegment(p, a.from, a.to) <= HIGHLIGHT_WIDTH / 2 + 2
    case 'redact': {
      const x1 = Math.min(a.from.x, a.to.x)
      const x2 = Math.max(a.from.x, a.to.x)
      const y1 = Math.min(a.from.y, a.to.y)
      const y2 = Math.max(a.from.y, a.to.y)
      return p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2
    }
    case 'rect': {
      const x1 = Math.min(a.from.x, a.to.x)
      const x2 = Math.max(a.from.x, a.to.x)
      const y1 = Math.min(a.from.y, a.to.y)
      const y2 = Math.max(a.from.y, a.to.y)
      const c = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }]
      return c.some((q, i) => distToSegment(p, q, c[(i + 1) % 4]) <= tol)
    }
    case 'text': {
      const b = boundsOf(a)
      return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height
    }
  }
}

/** Índice da anotação mais acima sob `p`, ou -1. */
export function hitTest(anns: Annotation[], p: Pt): number {
  for (let i = anns.length - 1; i >= 0; i--) if (hits(anns[i], p)) return i
  return -1
}

export function translate(a: Annotation, dx: number, dy: number): Annotation {
  const mv = (p: Pt): Pt => ({ x: p.x + dx, y: p.y + dy })
  switch (a.kind) {
    case 'pen':
      return { kind: 'pen', points: a.points.map(mv) }
    case 'text':
      return { ...a, at: mv(a.at) }
    default:
      return { ...a, from: mv(a.from), to: mv(a.to) }
  }
}
