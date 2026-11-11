import { app, nativeImage } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { searchEntries, type IndexEntry } from '../shared/search'
import type { CaptureHit, LibraryStats } from '../shared/types'
import { ocrImage } from './ocrImage'
import { outputDir } from './storage'

/** Índice das capturas: texto lido por OCR de cada PNG de Imagens\Printify. Fica em userData\index.json. */
interface Stored {
  mtime: number
  size: number
  /** `null` = ainda não indexada. */
  text: string | null
}

const entries = new Map<string, Stored>()
const pending: string[] = []
let working = false
let loaded = false
let saveTimer: NodeJS.Timeout | null = null

const indexFile = () => join(app.getPath('userData'), 'index.json')

function load(): void {
  if (loaded) return
  loaded = true
  try {
    const raw = JSON.parse(readFileSync(indexFile(), 'utf8')) as Record<string, Stored>
    for (const [path, v] of Object.entries(raw)) entries.set(path, v)
  } catch {
    /* primeiro uso */
  }
}

function saveSoon(): void {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      mkdirSync(app.getPath('userData'), { recursive: true })
      writeFileSync(indexFile(), JSON.stringify(Object.fromEntries(entries)))
    } catch (e) {
      console.error('Falha ao gravar o índice de capturas', e)
    }
  }, 1500)
}

/** Grava o índice na hora (ao sair do app). */
export function flushLibrary(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  try {
    writeFileSync(indexFile(), JSON.stringify(Object.fromEntries(entries)))
  } catch {
    /* sem problema: a próxima varredura reindexa */
  }
}

async function work(): Promise<void> {
  if (working) return
  working = true
  try {
    while (pending.length > 0) {
      const path = pending.shift()!
      const cur = entries.get(path)
      if (!cur || cur.text !== null || !existsSync(path)) continue
      try {
        const res = await ocrImage(readFileSync(path))
        entries.set(path, { ...cur, text: res.text })
      } catch (e) {
        // Marca como indexada (vazia) para não ficar tentando de novo a cada abertura.
        console.error('OCR falhou para', path, e)
        entries.set(path, { ...cur, text: '' })
      }
      saveSoon()
    }
  } finally {
    working = false
  }
}

/** Coloca uma captura na fila de indexação (em segundo plano, sem atrasar quem salvou). */
export function queueIndex(path: string): void {
  load()
  try {
    const st = statSync(path)
    entries.set(path, { mtime: st.mtimeMs, size: st.size, text: null })
  } catch {
    return
  }
  if (!pending.includes(path)) pending.push(path)
  void work()
}

/** Confere a pasta de capturas: indexa o que é novo ou mudou e esquece o que foi apagado. */
export function scanFolder(): void {
  load()
  const dir = outputDir('pictures')
  const onDisk = new Set<string>()
  for (const name of readdirSync(dir)) {
    if (!/\.png$/i.test(name)) continue
    const path = join(dir, name)
    onDisk.add(path)
    let st
    try {
      st = statSync(path)
    } catch {
      continue
    }
    const known = entries.get(path)
    if (!known || known.mtime !== st.mtimeMs || known.size !== st.size) {
      entries.set(path, { mtime: st.mtimeMs, size: st.size, text: null })
    }
    if (entries.get(path)!.text === null && !pending.includes(path)) pending.push(path)
  }
  for (const path of [...entries.keys()]) if (!onDisk.has(path) && !existsSync(path)) entries.delete(path)
  saveSoon()
  void work()
}

export function stats(): LibraryStats {
  load()
  let indexed = 0
  for (const v of entries.values()) if (v.text !== null) indexed++
  return { total: entries.size, indexed, pending: entries.size - indexed }
}

const thumbs = new Map<string, string>()

function thumbFor(path: string, mtime: number): string {
  const key = `${path}|${mtime}`
  const hit = thumbs.get(key)
  if (hit !== undefined) return hit
  let url = ''
  try {
    const img = nativeImage.createFromPath(path)
    if (!img.isEmpty()) url = img.resize({ width: 360, quality: 'good' }).toDataURL()
  } catch {
    /* arquivo ilegível: card sem miniatura */
  }
  if (thumbs.size > 400) thumbs.clear()
  thumbs.set(key, url)
  return url
}

export function search(query: string, limit = 60): CaptureHit[] {
  load()
  const list: IndexEntry[] = []
  for (const [path, v] of entries) {
    if (!existsSync(path)) continue
    list.push({ path, name: basename(path), mtime: v.mtime, text: v.text })
  }
  return searchEntries(list, query, limit).map(({ entry, snippet }) => ({
    path: entry.path,
    name: entry.name,
    mtime: entry.mtime,
    snippet,
    thumb: thumbFor(entry.path, entry.mtime)
  }))
}
