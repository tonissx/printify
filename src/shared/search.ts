/** Item do índice de capturas: o que a busca precisa saber de cada arquivo. */
export interface IndexEntry {
  path: string
  name: string
  mtime: number
  /** Texto lido por OCR; `null` enquanto a captura ainda não foi indexada. */
  text: string | null
}

export interface SearchResult {
  entry: IndexEntry
  snippet: string
  score: number
}

/**
 * Minúsculas e sem acento, mantendo o mesmo tamanho do original (assim os índices do texto dobrado valem
 * para o texto original, e dá para montar o trecho de contexto a partir dele).
 */
export function fold(s: string): string {
  let out = ''
  for (const ch of s) {
    const base = ch.normalize('NFD')[0] ?? ch
    const low = base.toLowerCase()
    out += low.length === ch.length ? low : ch
  }
  return out
}

const SNIPPET_RADIUS = 48

function makeSnippet(text: string, at: number, len: number): string {
  const from = Math.max(0, at - SNIPPET_RADIUS)
  const to = Math.min(text.length, at + len + SNIPPET_RADIUS)
  const body = text.slice(from, to).replace(/\s+/g, ' ').trim()
  return `${from > 0 ? '… ' : ''}${body}${to < text.length ? ' …' : ''}`
}

/**
 * Busca por todas as palavras da consulta (sem acento e sem diferenciar maiúsculas) no texto lido e no nome do arquivo.
 * Sem consulta, devolve as capturas mais recentes. Mais acertos primeiro; empate fica com a mais recente.
 */
export function searchEntries(entries: IndexEntry[], query: string, limit = 60): SearchResult[] {
  const terms = fold(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) {
    return [...entries]
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit)
      .map((entry) => ({ entry, snippet: '', score: 0 }))
  }

  const results: SearchResult[] = []
  for (const entry of entries) {
    const body = entry.text === null ? '' : fold(entry.text)
    const name = fold(entry.name)
    let score = 0
    let first = -1
    let firstLen = 0
    let ok = true
    for (const term of terms) {
      let hits = 0
      for (let i = body.indexOf(term); i !== -1; i = body.indexOf(term, i + term.length)) {
        hits++
        if (first === -1) {
          first = i
          firstLen = term.length
        }
      }
      const inName = name.includes(term)
      if (hits === 0 && !inName) {
        ok = false
        break
      }
      score += hits + (inName ? 2 : 0)
    }
    if (!ok) continue
    results.push({
      entry,
      snippet: first >= 0 && entry.text ? makeSnippet(entry.text, first, firstLen) : '',
      score
    })
  }
  return results.sort((a, b) => b.score - a.score || b.entry.mtime - a.entry.mtime).slice(0, limit)
}
