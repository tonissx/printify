// Componentes do design system Printify, portados de components/bundle.js para TSX.
// Mantêm as classes `pf-*` (styles/bundle.css) e as props de index.d.ts.
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ')

export type IconName =
  | 'area' | 'window' | 'screen' | 'record' | 'pause' | 'stop' | 'pen' | 'arrow' | 'text'
  | 'cursor' | 'highlight' | 'line' | 'rect' | 'crop' | 'copy' | 'folder' | 'timer' | 'mic' | 'camera' | 'check' | 'close'

type Shape = [string, Record<string, string | number>]
const P: Record<IconName, Shape[]> = {
  area: [['path', { d: 'M2.5 5V3.5a1 1 0 0 1 1-1H5M11 2.5h1.5a1 1 0 0 1 1 1V5M13.5 11v1.5a1 1 0 0 1-1 1H11M5 13.5H3.5a1 1 0 0 1-1-1V11' }]],
  window: [['rect', { x: 2, y: 3, width: 12, height: 10, rx: 1.5 }], ['path', { d: 'M2 6h12' }]],
  screen: [['rect', { x: 1.75, y: 2.5, width: 12.5, height: 8.5, rx: 1.5 }], ['path', { d: 'M5.5 13.5h5M8 11v2.5' }]],
  record: [['circle', { cx: 8, cy: 8, r: 5.5 }], ['circle', { cx: 8, cy: 8, r: 2.5, fill: 'currentColor', stroke: 'none' }]],
  pause: [['path', { d: 'M6 4v8M10 4v8' }]],
  stop: [['rect', { x: 4.5, y: 4.5, width: 7, height: 7, rx: 1.25, fill: 'currentColor', stroke: 'none' }]],
  pen: [['path', { d: 'M10.5 3 13 5.5 6 12.5 3 13l.5-3z' }]],
  arrow: [['path', { d: 'M3.5 12.5 12 4M6.5 4H12v5.5' }]],
  text: [['path', { d: 'M3.5 4V3h9v1M8 3v10M6 13h4' }]],
  cursor: [['path', { d: 'M4 2.5v10l2.7-2.6 1.8 3.6 1.7-.8-1.8-3.5H12z' }]],
  highlight: [['path', { d: 'm9 3.5 3.5 3.5-5 5H4v-3.5z' }], ['path', { d: 'M3 14h10' }]],
  line: [['path', { d: 'M3 13 13 3' }]],
  rect: [['rect', { x: 2.5, y: 3.5, width: 11, height: 9, rx: 1 }]],
  crop: [['path', { d: 'M4.5 1.5v9a1 1 0 0 0 1 1h9M1.5 4.5h9a1 1 0 0 1 1 1v9' }]],
  copy: [['rect', { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.5 }], ['path', { d: 'M10.5 5.5V3.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2' }]],
  folder: [['path', { d: 'M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z' }]],
  timer: [['circle', { cx: 8, cy: 9, r: 5 }], ['path', { d: 'M8 6.5V9l1.5 1.5M6.5 1.75h3' }]],
  mic: [['rect', { x: 6, y: 2, width: 4, height: 7.5, rx: 2 }], ['path', { d: 'M3.75 7.5a4.25 4.25 0 0 0 8.5 0M8 11.75V14' }]],
  camera: [['rect', { x: 1.75, y: 4, width: 9, height: 8, rx: 1.5 }], ['path', { d: 'm10.75 7 3.5-2v6l-3.5-2' }]],
  check: [['path', { d: 'm3.5 8.5 3 3 6-7' }]],
  close: [['path', { d: 'm4 4 8 8M12 4l-8 8' }]]
}

export function Icon({ name, size = 16, className, 'aria-label': label }: { name: IconName; size?: number; className?: string; 'aria-label'?: string }) {
  return (
    <svg
      className={cx('pf-icon', className)} viewBox="0 0 16 16" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}
    >
      {P[name].map(([tag, attrs], i) => {
        const Tag = tag as 'path'
        return <Tag key={i} {...attrs} />
      })}
    </svg>
  )
}

export function Kbd({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <kbd className={cx('pf-kbd', className)} aria-label={keys.join(' + ')}>
      {keys.map((k, i) => <span key={i} className="pf-kbd-key" aria-hidden>{k}</span>)}
    </kbd>
  )
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'record'
  size?: 'md' | 'sm'
  icon?: IconName
  kbd?: string[]
  children: ReactNode
}

export function Button({ variant = 'secondary', size, icon, kbd, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" {...rest} className={cx('pf-btn', `pf-btn-${variant}`, size === 'sm' && 'pf-btn-sm', className)}>
      {icon && <Icon name={icon} />}
      {children}
      {kbd && <Kbd keys={kbd} />}
    </button>
  )
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName
  label: string
  shortcut?: string
  active?: boolean
  size?: 'md' | 'sm'
}

export function IconButton({ icon, label, shortcut, active, size, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button" {...rest}
      className={cx('pf-ibtn', size === 'sm' && 'pf-ibtn-sm', className)}
      aria-label={label} title={label + (shortcut ? ` (${shortcut})` : '')}
      aria-pressed={active === undefined ? undefined : !!active}
    >
      <Icon name={icon} />
    </button>
  )
}

export interface SegmentedOption { value: string; label: string; icon?: IconName; shortcut?: string }

export function Segmented({ options, value, defaultValue, onChange, label, className }: {
  options: SegmentedOption[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; label: string; className?: string
}) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value)
  const current = value !== undefined ? value : inner
  const pick = (v: string) => {
    if (value === undefined) setInner(v)
    onChange?.(v)
  }
  return (
    <div className={cx('pf-seg', className)} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === current
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="pf-seg-opt"
            onClick={() => pick(o.value)} title={o.shortcut ? `${o.label} (${o.shortcut})` : undefined}
          >
            {o.icon && <Icon name={o.icon} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s))
  const m = Math.floor(s / 60)
  return `${m < 10 ? '0' : ''}${m}:${s % 60 < 10 ? '0' : ''}${s % 60}`
}

export function RecordPill({ seconds, paused, onPause, onStop, className }: {
  seconds: number; paused?: boolean; onPause?: () => void; onStop?: () => void; className?: string
}) {
  return (
    <div className={cx('pf-rec', paused && 'pf-rec-paused', className)} role="status" aria-live="off" aria-label={`${paused ? 'Pausado' : 'Gravando'} ${mmss(seconds)}`}>
      <span className="pf-rec-dot" aria-hidden />
      <span className="pf-rec-time">{mmss(seconds)}</span>
      <IconButton icon={paused ? 'record' : 'pause'} label={paused ? 'Continuar' : 'Pausar'} size="sm" onClick={onPause} />
      <IconButton icon="stop" label="Parar e salvar" shortcut="Ctrl G" size="sm" className="pf-rec-stop" onClick={onStop} />
    </div>
  )
}

export function Toast({ tone = 'ok', icon, action, onAction, children, className }: {
  tone?: 'ok' | 'neutral'; icon?: IconName; action?: string; onAction?: () => void; children: ReactNode; className?: string
}) {
  return (
    <div className={cx('pf-toast', `pf-toast-${tone}`, className)} role="status">
      <Icon name={icon ?? (tone === 'ok' ? 'check' : 'copy')} />
      {children}
      {action && <button type="button" className="pf-toast-action" onClick={onAction}>{action}</button>}
    </div>
  )
}
