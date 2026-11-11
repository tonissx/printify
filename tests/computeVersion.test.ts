import { describe, expect, it } from 'vitest'
import { decideVersion, latestOf, parseSemver } from '../scripts/compute-version.mjs'

describe('compute-version', () => {
  it('parseSemver aceita tag com ou sem "v" e rejeita o resto', () => {
    expect(parseSemver('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseSemver('0.1.42')).toEqual({ major: 0, minor: 1, patch: 42 })
    expect(parseSemver('latest')).toBeNull()
  })

  it('latestOf escolhe a maior versão e ignora tags inválidas', () => {
    expect(latestOf(['v0.1.3', 'latest', 'v0.1.10', 'v0.2.0', 'v0.1.9'])).toEqual({ major: 0, minor: 2, patch: 0 })
    expect(latestOf(['latest', 'nightly'])).toBeNull()
  })

  it('sem release anterior usa major.minor do package.json e o número da execução', () => {
    expect(decideVersion({ pkgMajor: 0, pkgMinor: 1, runNumber: 7, latest: null })).toEqual({ major: 0, minor: 1, patch: 7, warning: null })
  })

  it('mesmo major.minor da última release: patch = max(execução, último + 1)', () => {
    const latest = { major: 0, minor: 1, patch: 42 }
    expect(decideVersion({ pkgMajor: 0, pkgMinor: 1, runNumber: 50, latest }).patch).toBe(50)
    expect(decideVersion({ pkgMajor: 0, pkgMinor: 1, runNumber: 3, latest }).patch).toBe(43)
  })

  it('subir major.minor no package.json reinicia a linha de patch', () => {
    expect(decideVersion({ pkgMajor: 0, pkgMinor: 2, runNumber: 5, latest: { major: 0, minor: 1, patch: 42 } })).toEqual({
      major: 0, minor: 2, patch: 5, warning: null
    })
  })

  it('nunca regride se o package.json ficou para trás, e avisa', () => {
    const v = decideVersion({ pkgMajor: 0, pkgMinor: 1, runNumber: 5, latest: { major: 0, minor: 3, patch: 12 } })
    expect([v.major, v.minor, v.patch]).toEqual([0, 3, 13])
    expect(v.warning).toMatch(/atrás da última release/)
  })
})
