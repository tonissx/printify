export interface Semver {
  major: number
  minor: number
  patch: number
}
export function parseSemver(tag: unknown): Semver | null
export function latestOf(tags: string[]): Semver | null
export function decideVersion(input: {
  pkgMajor: number
  pkgMinor: number
  runNumber: number
  latest: Semver | null
}): Semver & { warning: string | null }
