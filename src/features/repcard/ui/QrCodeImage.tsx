import { useMemo } from 'react'
import { encode } from 'uqr'

interface QrCodeImageProps {
  value: string;
  /** Accessible description of what the code contains */
  label: string;
  className?: string;
}

const QUIET_ZONE = 4 // modules of blank margin scanners need around the code

/**
 * Renders `value` as a QR code: one SVG path (a run of dark modules per segment), always dark
 * navy on mint whatever the theme, because camera apps expect dark modules on a light ground.
 */
export function QrCodeImage({ value, label, className = '' }: QrCodeImageProps) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 0 })
    let d = ''
    qr.data.forEach((row, y) => {
      let x = 0
      while (x < row.length) {
        if (!row[x]) {
          x++
          continue
        }
        const start = x
        while (x < row.length && row[x]) x++
        d += `M${start} ${y}h${x - start}v1h${start - x}z`
      }
    })
    return { size: qr.size, path: d }
  }, [value])

  const extent = size + QUIET_ZONE * 2
  return (
    <svg
      viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={`block w-full h-auto rounded-2xl ${className}`}
    >
      <rect x={-QUIET_ZONE} y={-QUIET_ZONE} width={extent} height={extent} style={{ fill: 'var(--c-mint)' }} />
      <path d={path} style={{ fill: 'var(--c-navy)' }} />
    </svg>
  )
}
