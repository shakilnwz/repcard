/**
 * QR decoding for the in-app library scanner. Uses the native BarcodeDetector where the browser
 * has one with QR support (Chrome on Android, macOS), and otherwise lazy-loads jsQR, so the
 * decoder only downloads on devices that need it (e.g. iOS Safari).
 */

// BarcodeDetector is not in TypeScript's DOM lib yet
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorInstance;
  getSupportedFormats(): Promise<string[]>;
}

export interface QrDecoder {
  /** Returns the text of the first QR code found in the canvas, or null. */
  decode(canvas: HTMLCanvasElement, options?: { thorough?: boolean }): Promise<string | null>;
}

let decoderPromise: Promise<QrDecoder> | null = null

async function createDecoder(): Promise<QrDecoder> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
  if (Native) {
    try {
      if ((await Native.getSupportedFormats()).includes('qr_code')) {
        const detector = new Native({ formats: ['qr_code'] })
        return {
          decode: async (canvas) => (await detector.detect(canvas))[0]?.rawValue || null,
        }
      }
    } catch {
      // Fall through to jsQR
    }
  }

  const { default: jsQR } = await import('jsqr')
  return {
    decode: async (canvas, options) => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      // Live frames skip the inverted pass (our codes are dark-on-light) to keep scanning fast
      const result = jsQR(data, width, height, {
        inversionAttempts: options?.thorough ? 'attemptBoth' : 'dontInvert',
      })
      return result?.data || null
    },
  }
}

export function loadQrDecoder(): Promise<QrDecoder> {
  decoderPromise ??= createDecoder().catch((err) => {
    decoderPromise = null // allow a retry (e.g. the jsQR chunk failed to load while offline)
    throw err
  })
  return decoderPromise
}

/**
 * Draws `source` (cropped to `crop`) into `canvas`, scaled down so its longest side is at most
 * `maxSize` pixels. Smaller frames decode much faster and QR codes survive the downscale fine.
 */
export function drawScaled(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  crop: { x: number; y: number; width: number; height: number },
  maxSize: number,
): boolean {
  const scale = Math.min(1, maxSize / Math.max(crop.width, crop.height))
  const width = Math.max(1, Math.round(crop.width * scale))
  const height = Math.max(1, Math.round(crop.height * scale))
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
  return true
}

/** Decodes a QR code from a photo or screenshot the user picked. */
export async function decodeQrFromImageFile(file: Blob): Promise<string | null> {
  const [decoder, bitmap] = await Promise.all([loadQrDecoder(), createImageBitmap(file)])
  try {
    const canvas = document.createElement('canvas')
    const crop = { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
    if (!drawScaled(canvas, bitmap, crop, 1600)) return null
    return await decoder.decode(canvas, { thorough: true })
  } finally {
    bitmap.close()
  }
}

/** A user-facing reason the camera could not start. */
export function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow it in your browser settings, or scan from a photo.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device. Scan from a photo instead.'
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is busy in another app. Close it and try again.'
  }
  return 'The camera could not be started. Try scanning from a photo instead.'
}
