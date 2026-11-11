import { describe, expect, it } from 'vitest'
import { findSensitive, findSensitiveText, isValidCnpj, isValidCpf, isValidLuhn } from '../src/shared/sensitive'
import type { OcrLine } from '../src/shared/types'

const kinds = (s: string) => findSensitiveText(s).map((m) => [m.kind, s.slice(m.start, m.end)])

describe('validadores', () => {
  it('CPF: aceita válido, rejeita dígito errado e sequência repetida', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })
  it('CNPJ: aceita válido e rejeita inválido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false)
  })
  it('cartão: Luhn', () => {
    expect(isValidLuhn('4111 1111 1111 1111')).toBe(true)
    expect(isValidLuhn('4111 1111 1111 1112')).toBe(false)
  })
})

describe('findSensitiveText', () => {
  it('acha e-mail, CPF, CNPJ e cartão válidos', () => {
    expect(kinds('contato: ana.silva+x@empresa.com.br')).toEqual([['email', 'ana.silva+x@empresa.com.br']])
    expect(kinds('CPF 529.982.247-25 ok')).toEqual([['cpf', '529.982.247-25']])
    expect(kinds('CNPJ 11.222.333/0001-81')).toEqual([['cnpj', '11.222.333/0001-81']])
    expect(kinds('cartão 4111 1111 1111 1111 vence')).toEqual([['cartao', '4111 1111 1111 1111']])
  })

  it('ignora números parecidos que não validam (não esconde à toa)', () => {
    expect(findSensitiveText('pedido 123.456.789-00')).toEqual([])
    expect(findSensitiveText('protocolo 4111 1111 1111 1112')).toEqual([])
    expect(findSensitiveText('versão 1.2.3 e porta 8080')).toEqual([])
  })

  it('acha chaves de API, JWT e Bearer', () => {
    expect(kinds('ghp_abcdefghijklmnopqrstuvwxyz0123456789')[0][0]).toBe('chave')
    expect(kinds('AKIAIOSFODNN7EXAMPLE')[0][0]).toBe('chave')
    expect(kinds('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk')[0][0]).toBe('jwt')
    expect(kinds('Authorization: Bearer abcdefghijklmnop1234')).toEqual([['bearer', 'abcdefghijklmnop1234']])
  })

  it('oculta só o valor de senha/segredo, não o rótulo', () => {
    expect(kinds('senha: Abc12345')).toEqual([['segredo', 'Abc12345']])
    expect(kinds('API_KEY=xyz-98765')).toEqual([['segredo', 'xyz-98765']])
    expect(kinds('postgres://admin:s3cr3t@db.local/app')[0]).toEqual(['url-credenciais', 's3cr3t'])
  })

  it('não repete o mesmo trecho duas vezes', () => {
    const m = findSensitiveText('token: ghp_abcdefghijklmnopqrstuvwxyz0123456789')
    expect(m).toHaveLength(1)
  })
})

describe('findSensitive (linhas do OCR)', () => {
  const w = (text: string, x0: number) => ({ text, x0, y0: 10, x1: x0 + text.length * 8, y1: 24 })

  it('junta as palavras que o OCR separou e devolve a caixa do conjunto', () => {
    const line: OcrLine = {
      text: 'cartão 4111 1111 1111 1111',
      words: [w('cartão', 0), w('4111', 60), w('1111', 100), w('1111', 140), w('1111', 180)]
    }
    const [f] = findSensitive([line])
    expect(f.kind).toBe('cartao')
    expect(f.box.x0).toBe(60)
    expect(f.box.x1).toBe(180 + 4 * 8)
  })

  it('cobre só a palavra do valor numa linha "senha: valor"', () => {
    const line: OcrLine = { text: 'senha: Abc12345', words: [w('senha:', 0), w('Abc12345', 60)] }
    const [f] = findSensitive([line])
    expect(f.kind).toBe('segredo')
    expect(f.box.x0).toBe(60)
  })

  it('acha o CPF mesmo quando o OCR parte o número em duas palavras', () => {
    const line: OcrLine = { text: 'CPF 529.982 .247-25', words: [w('CPF', 0), w('529.982', 40), w('.247-25', 110)] }
    const [f] = findSensitive([line])
    expect(f.kind).toBe('cpf')
    expect(f.box.x0).toBe(40)
  })

  it('linha sem dados sensíveis não devolve nada', () => {
    expect(findSensitive([{ text: 'Olá mundo', words: [w('Olá', 0), w('mundo', 40)] }])).toEqual([])
  })
})
