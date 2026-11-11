import { useEffect, useState } from 'react'
import type { ToastInit } from '../../shared/types'
import { Toast } from '../ds'

export function ToastWindow() {
  const [init, setInit] = useState<ToastInit | null>(null)
  useEffect(() => {
    void window.printify.toastReady().then(setInit)
  }, [])
  if (!init) return null
  const reveal = init.revealPath
  return (
    <div className="toast-host">
      <Toast
        tone={init.tone ?? 'ok'}
        icon={init.tone === 'neutral' ? 'close' : undefined}
        action={init.action}
        onAction={reveal ? () => void window.printify.revealPath(reveal) : undefined}
      >
        {init.message}
      </Toast>
    </div>
  )
}
