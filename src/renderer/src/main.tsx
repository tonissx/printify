import '@fontsource/geist/400.css'
import '@fontsource/geist/500.css'
import '@fontsource/geist/600.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '../styles/tokens.css'
import '../styles/bundle.css'
import '../styles/app.css'
import { createRoot } from 'react-dom/client'
import type { PrintifyApi } from '../../shared/types'
import { Overlay } from '../windows/Overlay'
import { Pill } from '../windows/Pill'
import { ToastWindow } from '../windows/ToastWindow'

declare global {
  interface Window {
    printify: PrintifyApi
  }
}

const route = location.hash.replace(/^#\/?/, '')
const Root = route === 'overlay' ? Overlay : route === 'pill' ? Pill : ToastWindow
createRoot(document.getElementById('root')!).render(<Root />)
