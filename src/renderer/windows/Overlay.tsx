import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { RADIUS_PX, type Format, type OverlayInit, type Rect } from '../../shared/types'
import { Button, IconButton, Kbd, Segmented } from '../ds'
import { boundsOf, drawAnnotations, hitTest, translate, type Annotation, type Pt } from '../lib/annotations'
import { renderCapture } from '../lib/roundedCrop'
import { findSensitive } from '../../shared/sensitive'

type Tool = 'none' | 'pen' | 'highlight' | 'arrow' | 'line' | 'rect' | 'redact' | 'text'
type DrawTool = 'pen' | 'highlight' | 'arrow' | 'line' | 'rect' | 'redact'
const isDrawTool = (t: Tool): t is DrawTool => t !== 'none' && t !== 'text'
type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const MIN = 8

type Drag =
  | { kind: 'new'; sx: number; sy: number }
  | { kind: 'move'; sx: number; sy: number; start: Rect }
  | { kind: 'resize'; handle: Handle; sx: number; sy: number; start: Rect }
  | { kind: 'draw'; tool: DrawTool }
  | { kind: 'moveAnn'; idx: number; sx: number; sy: number; orig: Annotation }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

function normalize(x1: number, y1: number, x2: number, y2: number, W: number, H: number): Rect {
  const ax = clamp(Math.min(x1, x2), 0, W)
  const bx = clamp(Math.max(x1, x2), 0, W)
  const ay = clamp(Math.min(y1, y2), 0, H)
  const by = clamp(Math.max(y1, y2), 0, H)
  return { x: ax, y: ay, width: bx - ax, height: by - ay }
}

function resize(r: Rect, h: Handle, dx: number, dy: number, W: number, H: number): Rect {
  let x1 = r.x, y1 = r.y, x2 = r.x + r.width, y2 = r.y + r.height
  if (h.includes('w')) x1 += dx
  if (h.includes('e')) x2 += dx
  if (h.includes('n')) y1 += dy
  if (h.includes('s')) y2 += dy
  return normalize(x1, y1, x2, y2, W, H)
}

const inside = (r: Rect, p: Pt) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height

export function Overlay() {
  const [init, setInit] = useState<OverlayInit | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [tool, setTool] = useState<Tool>('none')
  const [anns, setAnns] = useState<Annotation[]>([])
  const [draft, setDraft] = useState<Annotation | null>(null)
  const [textAt, setTextAt] = useState<Pt | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [mic, setMic] = useState(false)
  const [countdownOn, setCountdownOn] = useState(false)
  const [format, setFormat] = useState<Format>('mp4')
  const [count, setCount] = useState<number | null>(null)
  const [barW, setBarW] = useState(420)

  const drag = useRef<Drag | null>(null)
  // Espelho do arrasto em estado: a interface precisa re-renderizar quando ele começa e termina.
  const [dragKind, setDragKind] = useState<Drag['kind'] | null>(null)
  const begin = (d: Drag) => {
    drag.current = d
    setDragKind(d.kind)
  }
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.printify.overlayReady().then((i) => {
      setInit(i)
      setMic(i.prefs.mic)
      setCountdownOn(i.prefs.countdown)
      setFormat(i.prefs.format)
    })
  }, [])

  const W = init?.bounds.width ?? 0
  const H = init?.bounds.height ?? 0
  const sf = init?.scaleFactor ?? 1
  const shot = init?.mode === 'shot'

  const flash = () => getComputedStyle(document.documentElement).getPropertyValue('--flash').trim() || '#f04a23'

  // Anotações: canvas do tamanho da tela, recortado pela seleção.
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !init) return
    c.width = Math.round(W * sf)
    c.height = Math.round(H * sf)
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    if (!rect) return
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x * sf, rect.y * sf, rect.width * sf, rect.height * sf)
    ctx.clip()
    const bd = imgRef.current ? { image: imgRef.current, width: W, height: H } : undefined
    drawAnnotations(ctx, draft ? [...anns, draft] : anns, flash(), sf, 0, 0, bd)
    // Contorno de seleção: só na pré-visualização, nunca no arquivo salvo.
    if (selected !== null && anns[selected]) {
      const b = boundsOf(anns[selected])
      const [bx, by, bw, bh] = [(b.x - 4) * sf, (b.y - 4) * sf, (b.width + 8) * sf, (b.height + 8) * sf]
      ctx.setLineDash([5 * sf, 4 * sf])
      ctx.lineWidth = 1.5 * sf
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.lineDashOffset = 4.5 * sf
      ctx.strokeStyle = '#fff'
      ctx.strokeRect(bx, by, bw, bh)
    }
    ctx.restore()
  }, [init, rect, anns, draft, selected, W, H, sf])

  // Trocar de ferramenta limpa a seleção.
  useEffect(() => {
    if (tool !== 'none') setSelected(null)
  }, [tool])

  useLayoutEffect(() => {
    if (barRef.current) setBarW(barRef.current.offsetWidth)
  }, [rect !== null, init])

  useEffect(() => {
    if (!textAt) return
    textRef.current?.focus()
    const t = setTimeout(() => textRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [textAt])

  const close = useCallback(() => void window.printify.closeOverlay(), [])

  const confirmShot = useCallback(
    async (copyOnly: boolean) => {
      const img = imgRef.current
      if (!img || !rect || !init) return
      const k = img.naturalWidth / init.bounds.width
      const canvas = document.createElement('canvas')
      renderCapture(
        canvas,
        img,
        { x: rect.x * k, y: rect.y * k, width: rect.width * k, height: rect.height * k },
        (init.prefs.rounded ? RADIUS_PX : 0) * k,
        (ctx) =>
          drawAnnotations(ctx as CanvasRenderingContext2D, anns, flash(), k, rect.x, rect.y, {
            image: img,
            width: init.bounds.width,
            height: init.bounds.height
          })
      )
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) return
      await window.printify.saveShot(new Uint8Array(await blob.arrayBuffer()), copyOnly)
    },
    [rect, init, anns]
  )

  // Recorte cru da seleção (sem anotações nem cantos), em PNG, para o OCR.
  const rawCrop = useCallback(async (): Promise<{ bytes: Uint8Array; k: number } | null> => {
    const img = imgRef.current
    if (!img || !rect || !init) return null
    const k = img.naturalWidth / init.bounds.width
    const canvas = document.createElement('canvas')
    renderCapture(canvas, img, { x: rect.x * k, y: rect.y * k, width: rect.width * k, height: rect.height * k }, 0)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), k } : null
  }, [rect, init])

  const say = useCallback((msg: string) => {
    setNote(msg)
    setTimeout(() => setNote((m) => (m === msg ? '' : m)), 4000)
  }, [])

  const copyImageText = useCallback(async () => {
    if (busy || !shot || !rect) return
    setBusy('Lendo o texto…')
    try {
      const crop = await rawCrop()
      if (!crop) return
      const res = await window.printify.ocr(crop.bytes)
      if (!res.text) say('Nenhum texto encontrado')
      else await window.printify.copyText(res.text)
    } catch (e) {
      console.error(e)
      say('Não foi possível ler o texto')
    } finally {
      setBusy(null)
    }
  }, [busy, shot, rect, rawCrop, say])

  const hideSensitive = useCallback(async () => {
    if (busy || !shot || !rect) return
    const area = rect
    setBusy('Procurando dados sensíveis…')
    try {
      const crop = await rawCrop()
      if (!crop) return
      const res = await window.printify.ocr(crop.bytes)
      const found = findSensitive(res.lines)
      if (found.length === 0) return say('Nenhum dado sensível encontrado')
      const pad = 2
      const added: Annotation[] = found.map((f) => ({
        kind: 'redact',
        from: { x: area.x + f.box.x0 / crop.k - pad, y: area.y + f.box.y0 / crop.k - pad },
        to: { x: area.x + f.box.x1 / crop.k + pad, y: area.y + f.box.y1 / crop.k + pad }
      }))
      setAnns((a) => [...a, ...added])
      say(`${added.length} ${added.length === 1 ? 'trecho ocultado' : 'trechos ocultados'}. Confira antes de salvar`)
    } catch (e) {
      console.error(e)
      say('Não foi possível ler o texto')
    } finally {
      setBusy(null)
    }
  }, [busy, shot, rect, rawCrop, say])

  const go = useCallback(() => {
    if (!rect) return
    void window.printify.startRecording({ mic, format }, rect)
  }, [rect, mic, format])

  const startRecord = useCallback(() => {
    if (!rect) return
    void window.printify.setPrefs({ mic, format, countdown: countdownOn })
    if (countdownOn) setCount(3)
    else go()
  }, [rect, mic, format, countdownOn, go])

  useEffect(() => {
    if (count === null) return
    if (count === 0) {
      go()
      return
    }
    const t = setTimeout(() => setCount(count - 1), 1000)
    return () => clearTimeout(t)
  }, [count, go])

  const selectAll = useCallback(() => {
    setRect({ x: 0, y: 0, width: W, height: H })
    setTool('none')
  }, [W, H])

  // Enter e clique fora disparam os dois (o campo some e perde o foco): só o primeiro vale.
  const textDone = useRef(false)
  useEffect(() => {
    if (textAt) textDone.current = false
  }, [textAt])

  const commitText = useCallback(
    (value: string) => {
      if (textDone.current) return
      textDone.current = true
      if (textAt && value.trim()) {
        setAnns((a) => [...a, { kind: 'text', at: textAt, text: value.trim() }])
        setSelected(anns.length)
      }
      setTextAt(null)
      setTool('none')
    },
    [textAt, anns.length]
  )

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'
      if (e.key === 'Escape') {
        if (count !== null) return setCount(null)
        if (textAt) {
          textDone.current = true
          setTextAt(null)
          return setTool('none')
        }
        if (tool !== 'none') return setTool('none')
        return close()
      }
      // Digitando texto: nenhum atalho vale (P, A, T, F, R... são letras comuns).
      if (typing || textAt || count !== null) return
      const k = e.key.toLowerCase()
      if (e.key === 'Enter' && rect) return shot ? void confirmShot(false) : startRecord()
      if (e.ctrlKey && k === 'c' && shot && rect) return void confirmShot(true)
      if (e.ctrlKey && k === 'z') {
        setSelected(null)
        return setAnns((a) => a.slice(0, -1))
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null) {
        setAnns((a) => a.filter((_, i) => i !== selected))
        return setSelected(null)
      }
      if (e.ctrlKey || e.altKey) return
      if (k === 'f') return selectAll()
      if (!rect) return
      if (shot) {
        if (k === 'p') setTool((t) => (t === 'pen' ? 'none' : 'pen'))
        if (k === 'v') setTool('none')
        if (k === 'o') void copyImageText()
        if (k === 'd') void hideSensitive()
        if (k === 'b') setTool((t) => (t === 'redact' ? 'none' : 'redact'))
        if (k === 'h') setTool((t) => (t === 'highlight' ? 'none' : 'highlight'))
        if (k === 'a') setTool((t) => (t === 'arrow' ? 'none' : 'arrow'))
        if (k === 'l') setTool((t) => (t === 'line' ? 'none' : 'line'))
        if (k === 'r') setTool((t) => (t === 'rect' ? 'none' : 'rect'))
        if (k === 't') setTool((t) => (t === 'text' ? 'none' : 'text'))
      } else if (k === 'r') startRecord()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rect, shot, count, textAt, selected, tool, close, confirmShot, startRecord, selectAll, copyImageText, hideSensitive])

  // Ponteiro
  const pt = (e: { clientX: number; clientY: number }): Pt => ({ x: clamp(e.clientX, 0, W), y: clamp(e.clientY, 0, H) })

  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0 || count !== null || textAt) return
    const p = pt(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (rect && inside(rect, p) && tool === 'text') {
      // Sem isso o clique tira o foco do campo de texto assim que ele aparece.
      e.preventDefault()
      setTextAt(p)
      return
    }
    if (rect && inside(rect, p) && isDrawTool(tool)) {
      begin({ kind: 'draw', tool })
      setDraft(tool === 'pen' ? { kind: 'pen', points: [p] } : { kind: tool, from: p, to: p })
      return
    }
    if (rect && inside(rect, p)) {
      // Sem ferramenta ativa, clicar num desenho o seleciona e permite arrastá-lo.
      const idx = hitTest(anns, p)
      if (idx >= 0) {
        setSelected(idx)
        begin({ kind: 'moveAnn', idx, sx: p.x, sy: p.y, orig: anns[idx] })
        return
      }
      setSelected(null)
      begin({ kind: 'move', sx: p.x, sy: p.y, start: rect })
      return
    }
    setAnns([])
    setSelected(null)
    setTool('none')
    begin({ kind: 'new', sx: p.x, sy: p.y })
    setRect({ x: p.x, y: p.y, width: 0, height: 0 })
  }

  const startResize = (h: Handle) => (e: RPointerEvent) => {
    if (!rect || e.button !== 0) return
    e.stopPropagation()
    ;(e.currentTarget.parentElement?.parentElement as HTMLElement).setPointerCapture(e.pointerId)
    const p = pt(e)
    begin({ kind: 'resize', handle: h, sx: p.x, sy: p.y, start: rect })
  }

  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current
    const p = pt(e)
    if (!d) {
      // Sem arrasto: destaca com cursor de "mover" quando o ponteiro está sobre um desenho.
      const over = tool === 'none' && !!rect && inside(rect, p) && hitTest(anns, p) >= 0
      if (over !== hover) setHover(over)
      return
    }
    if (d.kind === 'moveAnn') {
      const moved = translate(d.orig, p.x - d.sx, p.y - d.sy)
      setAnns((list) => list.map((a, i) => (i === d.idx ? moved : a)))
    } else if (d.kind === 'new') setRect(normalize(d.sx, d.sy, p.x, p.y, W, H))
    else if (d.kind === 'move') {
      const s = d.start
      setRect({
        ...s,
        x: clamp(s.x + p.x - d.sx, 0, W - s.width),
        y: clamp(s.y + p.y - d.sy, 0, H - s.height)
      })
    } else if (d.kind === 'resize') setRect(resize(d.start, d.handle, p.x - d.sx, p.y - d.sy, W, H))
    else
      setDraft((cur) => {
        if (!cur) return cur
        if (cur.kind === 'pen') return { kind: 'pen', points: [...cur.points, p] }
        if (cur.kind === 'arrow' || cur.kind === 'line' || cur.kind === 'rect' || cur.kind === 'highlight' || cur.kind === 'redact') return { ...cur, to: p }
        return cur
      })
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    setDragKind(null)
    if (!d) return
    if (d.kind === 'new') {
      setRect((r) => (r && r.width >= MIN && r.height >= MIN ? r : null))
    } else if (d.kind === 'draw') {
      const cur = draft
      setDraft(null)
      setTool('none')
      // Clique sem arrastar não cria uma linha/retângulo de tamanho zero.
      const empty = cur && cur.kind !== 'pen' && cur.kind !== 'text' && Math.hypot(cur.to.x - cur.from.x, cur.to.y - cur.from.y) < 3
      if (cur && !empty) {
        setAnns((a) => [...a, cur])
        setSelected(anns.length)
      }
    }
  }

  if (!init) return null

  const phys = rect ? `${Math.round(rect.width * sf)} × ${Math.round(rect.height * sf)}` : ''
  const BAR_H = 44
  let barLeft = 0
  let barTop = 0
  if (rect) {
    barLeft = clamp(rect.x + rect.width / 2 - barW / 2, 8, Math.max(8, W - barW - 8))
    barTop = rect.y + rect.height + 8
    if (barTop + BAR_H > H - 8) barTop = rect.y - BAR_H - 8
    if (barTop < 8) barTop = H - BAR_H - 24
  }
  const stop = (e: RPointerEvent) => e.stopPropagation()

  return (
    <div
      className={`ov ${dragKind === 'move' || dragKind === 'moveAnn' || hover ? 'ov-moving' : ''} ${tool !== 'none' ? 'ov-tool' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault()
        if (tool !== 'none') setTool('none')
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {init.image && <img ref={imgRef} className="ov-img" src={init.image} alt="" draggable={false} />}
      {!rect && <div className="ov-scrim" />}
      <canvas ref={canvasRef} className="ov-ann" />

      {rect && rect.width > 0 && (
        <div className="ov-sel" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
          {dragKind !== 'draw' && tool === 'none' &&
            HANDLES.map((h) => (
              <span key={h} className={`ov-h ov-h-${h}`}>
                <span className="ov-h-hit" onPointerDown={startResize(h)} />
              </span>
            ))}
        </div>
      )}

      {rect && rect.width > 0 && (
        <div className="ov-readout" style={{ left: rect.x, top: rect.y >= 24 ? rect.y - 22 : rect.y + 4 }}>{phys}</div>
      )}

      {textAt && (
        <input
          ref={textRef}
          className="ov-text"
          style={{ left: textAt.x, top: textAt.y, color: flash() }}
          onPointerDown={stop}
          onBlur={(e) => commitText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText(e.currentTarget.value)
            if (e.key === 'Escape') {
              e.stopPropagation()
              textDone.current = true
              setTextAt(null)
              setTool('none')
            }
          }}
        />
      )}

      {!rect && (
        <div className="ov-hint" onPointerDown={stop}>
          <span className="pf-toast">
            Arraste para selecionar {shot ? 'a área' : 'o que gravar'}
            <Button variant="secondary" size="sm" icon="screen" kbd={['F']} onClick={selectAll}>Tela inteira</Button>
            <Kbd keys={['Esc']} />
          </span>
        </div>
      )}

      {rect && rect.width > 0 && dragKind !== 'new' && count === null && (
        <div ref={barRef} className="pf-bar ov-bar" style={{ left: barLeft, top: barTop }} onPointerDown={stop} role="toolbar" aria-label={shot ? 'Ferramentas de print' : 'Ferramentas de gravação'}>
          {shot ? (
            <>
              <span className="pf-bar-group">
                <IconButton icon="cursor" label="Selecionar e mover" shortcut="V" size="sm" active={tool === 'none'} onClick={() => setTool('none')} />
                <IconButton icon="pen" label="Caneta" shortcut="P" size="sm" active={tool === 'pen'} onClick={() => setTool(tool === 'pen' ? 'none' : 'pen')} />
                <IconButton icon="arrow" label="Seta" shortcut="A" size="sm" active={tool === 'arrow'} onClick={() => setTool(tool === 'arrow' ? 'none' : 'arrow')} />
                <IconButton icon="highlight" label="Marca-texto" shortcut="H" size="sm" active={tool === 'highlight'} onClick={() => setTool(tool === 'highlight' ? 'none' : 'highlight')} />
                <IconButton icon="line" label="Linha" shortcut="L" size="sm" active={tool === 'line'} onClick={() => setTool(tool === 'line' ? 'none' : 'line')} />
                <IconButton icon="rect" label="Retângulo" shortcut="R" size="sm" active={tool === 'rect'} onClick={() => setTool(tool === 'rect' ? 'none' : 'rect')} />
                <IconButton icon="redact" label="Embaçar (ocultar uma área)" shortcut="B" size="sm" active={tool === 'redact'} onClick={() => setTool(tool === 'redact' ? 'none' : 'redact')} />
                <IconButton icon="text" label="Texto" shortcut="T" size="sm" active={tool === 'text'} onClick={() => setTool(tool === 'text' ? 'none' : 'text')} />
              </span>
              <span className="pf-bar-div" />
              <span className="pf-bar-group">
                <IconButton icon="shield" label="Ocultar dados sensíveis" shortcut="D" size="sm" disabled={!!busy} onClick={() => void hideSensitive()} />
                <IconButton icon="scan" label="Copiar texto da imagem" shortcut="O" size="sm" disabled={!!busy} onClick={() => void copyImageText()} />
              </span>
              <span className="pf-bar-div" />
              <IconButton icon="crop" label="Refazer seleção" size="sm" onClick={() => { setRect(null); setAnns([]); setTool('none') }} />
              <span className="pf-bar-div" />
              <Button variant="secondary" size="sm" icon="copy" kbd={['Ctrl', 'C']} onClick={() => void confirmShot(true)}>Copiar</Button>
              <Button variant="primary" size="sm" kbd={['⏎']} onClick={() => void confirmShot(false)}>Salvar</Button>
            </>
          ) : (
            <>
              <span className="pf-bar-group">
                <IconButton icon="mic" label="Microfone" size="sm" active={mic} onClick={() => setMic(!mic)} />
                <IconButton icon="timer" label="Contagem de 3 s" size="sm" active={countdownOn} onClick={() => setCountdownOn(!countdownOn)} />
              </span>
              <span className="pf-bar-div" />
              <Segmented
                label="Formato" value={format} onChange={(v) => setFormat(v as Format)}
                options={[{ value: 'mp4', label: 'MP4' }, { value: 'gif', label: 'GIF' }]}
              />
              <span className="pf-bar-div" />
              <IconButton icon="crop" label="Refazer seleção" size="sm" onClick={() => setRect(null)} />
              <Button variant="record" size="sm" icon="record" kbd={['R']} onClick={startRecord}>Gravar</Button>
            </>
          )}
          <IconButton icon="close" label="Fechar" shortcut="Esc" size="sm" onClick={close} />
        </div>
      )}

      {(busy || note) && rect && count === null && (
        <div
          className="ov-note"
          style={{ left: barLeft, top: clamp(barTop > rect.y ? barTop + BAR_H + 6 : barTop - 30, 4, H - 30) }}
          onPointerDown={stop}
          role="status"
        >
          {busy ?? note}
        </div>
      )}

      {count !== null && rect && (
        <div className="ov-count" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} onPointerDown={stop}>
          <span className="ov-count-n">{count}</span>
          <Button variant="primary" size="sm" onClick={go}>Começar já</Button>
        </div>
      )}
    </div>
  )
}
