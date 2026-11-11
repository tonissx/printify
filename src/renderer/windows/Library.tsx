import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CaptureHit, LibraryStats } from '../../shared/types'
import { fold } from '../../shared/search'
import { Icon, IconButton, Toast } from '../ds'

/** Destaca no trecho as palavras da busca (sem acento e sem diferenciar maiúsculas). */
function highlight(text: string, query: string): ReactNode {
  const terms = fold(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0 || !text) return text
  const f = fold(text)
  const marks: Array<[number, number]> = []
  for (const t of terms) for (let i = f.indexOf(t); i !== -1; i = f.indexOf(t, i + t.length)) marks.push([i, i + t.length])
  marks.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const m of marks) {
    const last = merged[merged.length - 1]
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1])
    else merged.push([m[0], m[1]])
  }
  const out: ReactNode[] = []
  let at = 0
  merged.forEach(([s, e], i) => {
    out.push(text.slice(at, s), <mark key={i}>{text.slice(s, e)}</mark>)
    at = e
  })
  out.push(text.slice(at))
  return out
}

const when = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function Library() {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<CaptureHit[] | null>(null)
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [toast, setToast] = useState('')
  const input = useRef<HTMLInputElement>(null)

  // Estado da indexação: atualiza a cada 1,5 s enquanto a janela está aberta.
  useEffect(() => {
    let on = true
    const tick = () => void window.printify.libStats().then((s) => on && setStats(s))
    tick()
    const id = setInterval(tick, 1500)
    return () => {
      on = false
      clearInterval(id)
    }
  }, [])

  // Busca: a cada digitação e também quando a indexação avança (os resultados vão aparecendo).
  useEffect(() => {
    let on = true
    const id = setTimeout(() => void window.printify.libSearch(query).then((h) => on && setHits(h)), query ? 120 : 0)
    return () => {
      on = false
      clearTimeout(id)
    }
  }, [query, stats?.indexed, stats?.total])

  useEffect(() => input.current?.focus(), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(id)
  }, [toast])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') query ? setQuery('') : window.close()
  }

  const pending = stats?.pending ?? 0

  return (
    <div className="lib" onKeyDown={onKey}>
      <header className="lib-head">
        <h1 className="lib-title">Capturas</h1>
        <label className="lib-search">
          <Icon name="search" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar texto nas capturas…"
            aria-label="Buscar texto nas capturas"
            spellCheck={false}
          />
        </label>
        <span className="lib-status" role="status">
          {!stats ? '' : pending > 0 ? `Lendo ${pending} ${pending === 1 ? 'captura' : 'capturas'}…` : `${stats.total} ${stats.total === 1 ? 'captura' : 'capturas'}`}
        </span>
      </header>

      <main className="lib-body">
        {hits === null ? null : hits.length === 0 ? (
          <div className="lib-empty">
            {query ? (
              <>
                <p className="lib-empty-title">Nenhuma captura com “{query}”</p>
                <p>{pending > 0 ? `Ainda estou lendo ${pending} capturas; os resultados podem aumentar.` : 'Tente outra palavra. A busca ignora acentos e maiúsculas.'}</p>
              </>
            ) : (
              <>
                <p className="lib-empty-title">Nenhuma captura ainda</p>
                <p>Capture com Ctrl + Print Screen. O texto de cada print fica pesquisável aqui.</p>
              </>
            )}
          </div>
        ) : (
          <ul className="lib-grid">
            {hits.map((h) => (
              <li key={h.path} className="lib-card">
                <button type="button" className="lib-thumb" onClick={() => void window.printify.libOpen(h.path)} title="Abrir imagem">
                  {h.thumb ? <img src={h.thumb} alt="" draggable={false} /> : <span>Sem miniatura</span>}
                </button>
                <div className="lib-meta">
                  <span className="lib-date">{when(h.mtime)}</span>
                  <span className="lib-actions">
                    <IconButton
                      icon="copy" label="Copiar imagem" size="sm"
                      onClick={() => void window.printify.libCopyImage(h.path).then(() => setToast('Imagem copiada'))}
                    />
                    <IconButton icon="folder" label="Mostrar na pasta" size="sm" onClick={() => void window.printify.libReveal(h.path)} />
                  </span>
                </div>
                {h.snippet && <p className="lib-snippet">{highlight(h.snippet, query)}</p>}
              </li>
            ))}
          </ul>
        )}
      </main>

      {toast && (
        <div className="lib-toast">
          <Toast>{toast}</Toast>
        </div>
      )}
    </div>
  )
}
