import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_PREFS, type Prefs } from '../shared/types'

const file = () => join(app.getPath('userData'), 'prefs.json')

export function getPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(readFileSync(file(), 'utf8')) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch }
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(file(), JSON.stringify(next, null, 2))
  } catch (e) {
    console.error('Falha ao gravar preferências', e)
  }
  return next
}

/** Pasta de destino: Imagens\Printify ou Vídeos\Printify, criada se faltar. */
export function outputDir(kind: 'pictures' | 'videos'): string {
  const dir = join(app.getPath(kind), 'Printify')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** "Printify 2026-11-11 15.20.31" */
export function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `Printify ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`
}
