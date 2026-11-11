import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import type { Format } from '../shared/types'

function binary(): string {
  if (!ffmpegPath) throw new Error('ffmpeg-static não encontrou o binário')
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
}

export function ffmpegArgs(input: string, output: string, format: Format): string[] {
  if (format === 'gif') {
    return [
      '-y', '-i', input, '-t', '30',
      '-vf', 'fps=12,scale=720:-1:flags=lanczos:force_original_aspect_ratio=decrease,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
      output
    ]
  }
  return [
    '-y', '-i', input,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-movflags', '+faststart',
    output
  ]
}

/** Converte o WebM gravado para MP4 ou GIF. Resolve com o caminho de saída. */
export function convert(input: string, output: string, format: Format): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary(), ffmpegArgs(input, output, format), { windowsHide: true })
    let err = ''
    proc.stderr.on('data', (d) => (err += d))
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve(output) : reject(new Error(err.slice(-400) || `ffmpeg saiu com ${code}`))))
  })
}
