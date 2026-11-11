import { createWorker, type Worker } from 'tesseract.js'
import type { OcrLine, OcrResult } from '../shared/types'

export interface OcrPaths {
  /** Script do worker do tesseract.js (node_modules/tesseract.js/src/worker-script/node/index.js). */
  workerPath: string
  /** Pasta com `por.traineddata.gz` e `eng.traineddata.gz`. */
  langPath: string
}

let paths: OcrPaths | null = null
let workerPromise: Promise<Worker> | null = null
// Um reconhecimento por vez: o worker é único e a fila evita disputa entre OCR do print e indexação.
let queue: Promise<unknown> = Promise.resolve()

export function configureOcr(p: OcrPaths): void {
  paths = p
}

function getWorker(): Promise<Worker> {
  if (!paths) throw new Error('OCR não configurado: chame configureOcr() antes.')
  if (!workerPromise) {
    const { workerPath, langPath } = paths
    workerPromise = createWorker(['por', 'eng'], 1, {
      workerPath,
      langPath,
      gzip: true,
      cacheMethod: 'none'
    }).catch((err) => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

/**
 * Lê o texto de um PNG, offline. `scale` diz quantas vezes a imagem foi ampliada antes de chegar aqui:
 * as caixas voltam em pixels da imagem original.
 */
export function recognize(png: Buffer, scale = 1): Promise<OcrResult> {
  const run = async (): Promise<OcrResult> => {
    const worker = await getWorker()
    const { data } = await worker.recognize(png, {}, { text: true, blocks: true })
    const lines: OcrLine[] = []
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const words = line.words
            // Sem filtro por confiança: o tesseract devolve confiança 0 em dígitos que leu certo, e a detecção
            // de dados sensíveis já valida (dígito verificador, Luhn) o que encontra.
            .filter((w) => w.text.trim() !== '')
            .map((w) => ({
              text: w.text.trim(),
              x0: w.bbox.x0 / scale,
              y0: w.bbox.y0 / scale,
              x1: w.bbox.x1 / scale,
              y1: w.bbox.y1 / scale
            }))
          if (words.length > 0) lines.push({ text: words.map((w) => w.text).join(' '), words })
        }
      }
    }
    return { text: data.text.trim(), lines }
  }
  const result = queue.then(run, run)
  queue = result.catch(() => undefined)
  return result
}

export async function shutdownOcr(): Promise<void> {
  const w = workerPromise
  workerPromise = null
  if (w) await (await w).terminate().catch(() => undefined)
}
