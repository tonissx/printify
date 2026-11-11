import type { OcrLine } from './types'

export type SensitiveKind =
  | 'email' | 'cpf' | 'cnpj' | 'cartao' | 'telefone' | 'jwt' | 'chave' | 'bearer' | 'segredo' | 'url-credenciais'

export interface TextMatch {
  kind: SensitiveKind
  start: number
  end: number
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface Finding {
  kind: SensitiveKind
  box: Box
}

const digits = (s: string) => s.replace(/\D/g, '')

export function isValidCpf(raw: string): boolean {
  const d = digits(raw)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

export function isValidCnpj(raw: string): boolean {
  const d = digits(raw)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13])
}

export function isValidLuhn(raw: string): boolean {
  const d = digits(raw)
  if (d.length < 13 || d.length > 19 || /^(\d)\1+$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

interface Rule {
  kind: SensitiveKind
  re: RegExp
  /** Grupo de captura a ocultar (padrão: o trecho inteiro). */
  group?: number
  valid?: (match: string) => boolean
}

const RULES: Rule[] = [
  // Ordem = prioridade: as mais específicas primeiro, para que uma senha em URL não vire "e-mail".
  { kind: 'url-credenciais', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:([^\s@/]+)@\S+/gi, group: 1 },
  {
    kind: 'segredo',
    re: /\b(?:senha|password|passwd|pwd|secret|segredo|token|api[_-]?key|apikey|client[_-]?secret)\b["']?\s*[:=]\s*["']?([^\s"',;]{3,})/gi,
    group: 1
  },
  { kind: 'bearer', re: /\bBearer\s+([A-Za-z0-9._~+/=-]{16,})/g, group: 1 },
  { kind: 'jwt', re: /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g },
  {
    kind: 'chave',
    re: /\b(?:sk-[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_\w{20,}|glpat-[\w-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[\w-]{10,})/g
  },
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g },
  { kind: 'cnpj', re: /(?<!\d)\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}(?!\d)/g, valid: isValidCnpj },
  { kind: 'cpf', re: /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, valid: isValidCpf },
  { kind: 'cartao', re: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, valid: isValidLuhn },
  { kind: 'telefone', re: /(?<!\d)(?:\+55[ ]?)?\(?\d{2}\)?[ ]?9\d{4}[- ]?\d{4}(?!\d)/g }
]

/** Procura dados sensíveis num texto. Os intervalos devolvidos não se sobrepõem. */
export function findSensitiveText(text: string): TextMatch[] {
  const found: TextMatch[] = []
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.re)) {
      if (rule.valid && !rule.valid(m[0])) continue
      let start = m.index ?? 0
      let end = start + m[0].length
      if (rule.group) {
        const g = m[rule.group]
        if (!g) continue
        start = start + m[0].lastIndexOf(g)
        end = start + g.length
      }
      // Regras anteriores têm prioridade: um trecho já coberto não é marcado de novo.
      if (found.some((f) => start < f.end && end > f.start)) continue
      found.push({ kind: rule.kind, start, end })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

/**
 * Procura dados sensíveis nas linhas do OCR e devolve as caixas (em pixels da imagem) a ocultar.
 * Cada linha é analisada como texto corrido, para pegar padrões que o OCR quebrou em várias palavras. Roda duas
 * vezes: com espaço entre as palavras (cartão "4111 1111 ...") e sem (CPF que o OCR partiu em "529.982" e ".247-25").
 */
export function findSensitive(lines: OcrLine[]): Finding[] {
  const out: Finding[] = []
  const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

  for (const line of lines) {
    if (line.words.length === 0) continue
    for (const joiner of [' ', '']) {
      let text = ''
      const spans = line.words.map((w) => {
        if (text) text += joiner
        const start = text.length
        text += w.text
        return { start, end: text.length, w }
      })
      for (const m of findSensitiveText(text)) {
        const hit = spans.filter((s) => s.start < m.end && s.end > m.start)
        if (hit.length === 0) continue
        const box = {
          x0: Math.min(...hit.map((s) => s.w.x0)),
          y0: Math.min(...hit.map((s) => s.w.y0)),
          x1: Math.max(...hit.map((s) => s.w.x1)),
          y1: Math.max(...hit.map((s) => s.w.y1))
        }
        if (!out.some((f) => overlaps(f.box, box))) out.push({ kind: m.kind, box })
      }
    }
  }
  return out
}

export const KIND_LABEL: Record<SensitiveKind, string> = {
  email: 'e-mail',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  cartao: 'cartão',
  telefone: 'telefone',
  jwt: 'token JWT',
  chave: 'chave de API',
  bearer: 'token',
  segredo: 'senha ou segredo',
  'url-credenciais': 'credenciais em URL'
}
