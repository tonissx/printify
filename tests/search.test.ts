import { describe, expect, it } from 'vitest'
import { fold, searchEntries, type IndexEntry } from '../src/shared/search'

const e = (name: string, mtime: number, text: string | null): IndexEntry => ({ path: `C:\\img\\${name}`, name, mtime, text })

const entries = [
  e('Printify 2026-11-10 09.00.00.png', 100, 'Erro: timeout ao conectar no servidor de produção'),
  e('Printify 2026-11-11 10.30.00.png', 300, 'Relatório de conciliação bancária do mês'),
  e('Printify 2026-11-11 11.00.00.png', 200, 'Timeout excedido. Tente novamente. timeout timeout'),
  e('Printify 2026-11-11 12.00.00.png', 400, null)
]

describe('searchEntries', () => {
  it('ignora acento e maiúsculas, e exige todas as palavras', () => {
    const r = searchEntries(entries, 'PRODUCAO timeout')
    expect(r.map((x) => x.entry.mtime)).toEqual([100])
  })

  it('ordena por número de ocorrências e desempata pela mais recente', () => {
    const r = searchEntries(entries, 'timeout')
    expect(r.map((x) => x.entry.mtime)).toEqual([200, 100])
  })

  it('traz um trecho de contexto ao redor do primeiro acerto', () => {
    const [r] = searchEntries(entries, 'conciliacao')
    expect(r.snippet).toContain('conciliação')
  })

  it('também encontra pelo nome do arquivo (data)', () => {
    const r = searchEntries(entries, '2026-11-10')
    expect(r.map((x) => x.entry.mtime)).toEqual([100])
  })

  it('sem consulta lista as mais recentes primeiro, inclusive as ainda não indexadas', () => {
    const r = searchEntries(entries, '   ')
    expect(r.map((x) => x.entry.mtime)).toEqual([400, 300, 200, 100])
  })

  it('captura ainda não indexada não casa com termos de texto', () => {
    expect(searchEntries(entries, 'relatorio').map((x) => x.entry.mtime)).toEqual([300])
  })

  it('respeita o limite', () => {
    expect(searchEntries(entries, '', 2)).toHaveLength(2)
  })
})

describe('fold', () => {
  it('mantém o tamanho do texto', () => {
    const s = 'Conciliação Bancária — ÇÃO'
    expect(fold(s)).toHaveLength(s.length)
    expect(fold(s)).toBe('conciliacao bancaria — cao')
  })
})
