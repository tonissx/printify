// Gera src/renderer/styles/tokens.css a partir de tokens.json do design system Printify.
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../src/renderer/styles/', import.meta.url)
const t = JSON.parse(readFileSync(new URL('tokens.json', dir), 'utf8'))
const val = (v) => v.replace(/\{([\w-]+)\}/g, 'var(--$1)')
const themed = (list, theme) =>
  list.map((k) => `  --${k.name}: ${val(typeof k.value === 'string' ? k.value : (k.value[theme] ?? k.value.light))};`)
const plain = (list) => list.map((k) => `  --${k.name}: ${k.value};`)

const light = [...themed(t.color.tokens, 'light'), ...themed(t.shadow.tokens, 'light')]
const dark = [...themed(t.color.tokens, 'dark'), ...themed(t.shadow.tokens, 'dark')]
const fixed = [
  ...plain(t.spacing.tokens),
  ...plain(t.radius.tokens),
  ...plain(t.duration.tokens),
  `  --font-sans: ${t.type.families.sans};`,
  `  --font-mono: ${t.type.families.mono};`
]

const css = `/* Gerado por scripts/gen-tokens.mjs a partir de tokens.json. Não edite. */
:root {
${[...light, ...fixed].join('\n')}
}
@media (prefers-color-scheme: dark) {
  :root {
${dark.map((l) => '  ' + l).join('\n')}
  }
}
`
writeFileSync(new URL('tokens.css', dir), css)
console.log('tokens.css gerado')
