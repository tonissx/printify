import { useEffect, useRef, useState } from 'react'
import { RecordPill } from '../ds'

/** Janela do indicador de gravação. Também é quem grava (a janela é excluída da captura). */
export function Pill() {
  const [seconds, setSeconds] = useState(0)
  const [paused, setPaused] = useState(false)
  const rec = useRef<MediaRecorder | null>(null)
  const pausedRef = useRef(false)
  const elapsed = useRef(0)
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => {
    let cancelled = false
    const cleanups: Array<() => void> = []

    async function run() {
      const init = await window.printify.pillReady()
      // Dá tempo da janela de seleção sumir antes do primeiro frame.
      await new Promise((r) => setTimeout(r, 250))
      if (cancelled) return

      // getDisplayMedia exige um gesto do usuário nesta janela (que nunca recebe clique);
      // a captura por fonte do Electron não exige.
      const display = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: init.sourceId } }
      } as unknown as MediaStreamConstraints)
      cleanups.push(() => display.getTracks().forEach((t) => t.stop()))

      const video = document.createElement('video')
      video.muted = true
      video.srcObject = display
      await video.play()

      const k = video.videoWidth / init.bounds.width
      const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
      const w = even(init.region.width * k)
      const h = even(init.region.height * k)
      const sx = init.region.x * k
      const sy = init.region.y * k

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      const draw = setInterval(() => ctx.drawImage(video, sx, sy, w, h, 0, 0, w, h), 1000 / 30)
      cleanups.push(() => clearInterval(draw))

      const stream = canvas.captureStream(30)
      if (init.mic) {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
          mic.getAudioTracks().forEach((t) => stream.addTrack(t))
          cleanups.push(() => mic.getTracks().forEach((t) => t.stop()))
        } catch (e) {
          console.warn('Microfone indisponível, gravando sem áudio', e)
        }
      }

      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      recorder.onstop = async () => {
        cleanups.forEach((c) => c())
        const data = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())
        await window.printify.saveRecording(data, init.format)
      }
      rec.current = recorder
      stopRef.current = () => recorder.state !== 'inactive' && recorder.stop()
      recorder.start(1000)

      const tick = setInterval(() => {
        if (pausedRef.current) return
        elapsed.current += 250
        setSeconds(Math.floor(elapsed.current / 1000))
      }, 250)
      cleanups.push(() => clearInterval(tick))
    }

    window.printify.onStopRequest(() => stopRef.current())
    run().catch((err) => {
      console.error('Falha ao iniciar a gravação', err instanceof Error ? err.name + ': ' + err.message : String(err))
      cleanups.forEach((c) => c())
      void window.printify.cancelRecording(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const togglePause = () => {
    const r = rec.current
    if (!r) return
    if (r.state === 'recording') {
      r.pause()
      pausedRef.current = true
      setPaused(true)
    } else if (r.state === 'paused') {
      r.resume()
      pausedRef.current = false
      setPaused(false)
    }
  }

  return (
    <div className="pill-host">
      <RecordPill seconds={seconds} paused={paused} onPause={togglePause} onStop={() => stopRef.current()} />
    </div>
  )
}
