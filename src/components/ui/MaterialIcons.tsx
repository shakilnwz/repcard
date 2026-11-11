import React from 'react'

export interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  fill?: boolean;
  weight?: number;
  grade?: number;
  opticalSize?: number;
  className?: string;
}

function getFontSizeStyle(className?: string): React.CSSProperties {
  if (!className) return { fontSize: '24px' }
  if (className.includes('w-3 ') || className.endsWith('w-3') || className.includes('h-3')) return { fontSize: '12px' }
  if (className.includes('w-3.5') || className.includes('h-3.5')) return { fontSize: '14px' }
  if (className.includes('w-4') || className.includes('h-4')) return { fontSize: '16px' }
  if (className.includes('w-5') || className.includes('h-5')) return { fontSize: '20px' }
  if (className.includes('w-6') || className.includes('h-6')) return { fontSize: '24px' }
  if (className.includes('w-7') || className.includes('h-7')) return { fontSize: '28px' }
  if (className.includes('w-8') || className.includes('h-8')) return { fontSize: '32px' }
  return { fontSize: '24px' }
}

export function MaterialIcon({
  name,
  fill = false,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  className = '',
  style,
  ...props
}: MaterialIconProps) {
  const isFilled = fill || className.includes('fill-current')
  const sizeStyle = getFontSizeStyle(className)

  const variationStyle: React.CSSProperties = {
    fontVariationSettings: `'FILL' ${isFilled ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    ...sizeStyle,
    ...style,
  }

  return (
    <span
      className={`material-symbols-rounded select-none shrink-0 ${className}`}
      style={variationStyle}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  )
}

// Named Icon Components (Google Material Symbols replacements)
export const Menu = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="menu" {...props} />
export const Star = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="star" {...props} />
export const ExternalLink = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="open_in_new" {...props} />
export const Sparkles = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="auto_awesome" {...props} />
export const Flame = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="local_fire_department" {...props} />
export const CheckCircle2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="check_circle" {...props} />
export const X = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="close" {...props} />
export const Plus = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="add" {...props} />
export const RefreshCw = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="sync" {...props} />
export const Share2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="share" {...props} />
export const Trash2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="delete" {...props} />
export const Check = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="check" {...props} />
export const AlertCircle = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="error" {...props} />
export const ShieldCheck = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="verified_user" {...props} />
export const Database = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="database" {...props} />
export const RotateCcw = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="undo" {...props} />
export const Palette = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="palette" {...props} />
export const Download = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="download" {...props} />
export const Upload = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="upload" {...props} />
export const FileText = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="description" {...props} />
