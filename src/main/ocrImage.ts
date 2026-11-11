import { nativeImage } from 'electron'
import type { OcrResult } from '../shared/types'
import { recognize } from './ocr'

/** Texto de tela é pequeno: ampliar 2× antes do OCR preserva pontos e vírgulas (e-mails, CPFs, valores). */
const SCALE = 2
/** Acima disso a imagem já é grande o bastante (e a ampliação ficaria pesada). */
const MAX_WIDTH_FOR_UPSCALE = 2400

export function ocrImage(png: Buffer): Promise<OcrResult> {
  const img = nativeImage.createFromBuffer(png)
  const { width } = img.getSize()
  if (width === 0 || width > MAX_WIDTH_FOR_UPSCALE) return recognize(png, 1)
  const big = img.resize({ width: width * SCALE, quality: 'best' }).toPNG()
  return recognize(big, SCALE)
}
