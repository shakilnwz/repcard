import React from 'react'

/*
 * Icons come from a subset of Material Symbols Rounded (see vite.config.ts): only the glyphs
 * named below are downloaded, at a fixed 24 opsz / 400 weight / 0 grade, with FILL 0..1.
 * To add an icon, add a named export with its `name="..."` here; the font URL picks it up.
 */
export interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  fill?: boolean;
  className?: string;
}

function getFontSizeStyle(className?: string): React.CSSProperties {
  if (!className) return { fontSize: '24px' }
  if (/(?:^|\s)[wh]-2\.5(?:\s|$)/.test(className)) return { fontSize: '10px' }
  if (/(?:^|\s)[wh]-3\.5(?:\s|$)/.test(className)) return { fontSize: '14px' }
  if (/(?:^|\s)[wh]-3(?:\s|$)/.test(className)) return { fontSize: '12px' }
  if (/(?:^|\s)[wh]-4\.5(?:\s|$)/.test(className)) return { fontSize: '18px' }
  if (/(?:^|\s)[wh]-4(?:\s|$)/.test(className)) return { fontSize: '16px' }
  if (/(?:^|\s)[wh]-5(?:\s|$)/.test(className)) return { fontSize: '20px' }
  if (/(?:^|\s)[wh]-6(?:\s|$)/.test(className)) return { fontSize: '24px' }
  if (/(?:^|\s)[wh]-7(?:\s|$)/.test(className)) return { fontSize: '28px' }
  if (/(?:^|\s)[wh]-8(?:\s|$)/.test(className)) return { fontSize: '32px' }
  return { fontSize: '24px' }
}

export function MaterialIcon({
  name,
  fill = false,
  className = '',
  style,
  ...props
}: MaterialIconProps) {
  const isFilled = fill || className.includes('fill-current')
  const sizeStyle = getFontSizeStyle(className)

  const variationStyle: React.CSSProperties = {
    fontVariationSettings: `'FILL' ${isFilled ? 1 : 0}`,
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
export const Tune = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="tune" {...props} />
export const ViewSidebar = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="view_sidebar" {...props} />
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
export const QrCode = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="qr_code_2" {...props} />
export const QrCodeScanner = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="qr_code_scanner" {...props} />
export const Copy = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="content_copy" {...props} />
export const ImageIcon = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="image" {...props} />
export const NoPhotography = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="no_photography" {...props} />
export const ListView = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="format_list_bulleted" {...props} />
export const CardsView = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="style" {...props} />
export const ExpandMore = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="expand_more" {...props} />
export const Sort = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="sort" {...props} />
export const ArrowUpward = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="arrow_upward" {...props} />
export const ArrowDownward = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="arrow_downward" {...props} />
export const TouchApp = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="touch_app" {...props} />
export const Hub = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="hub" {...props} />
export const RadarIcon = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="radar" {...props} />

// Knowledgebase & renderer icons (Google Material Symbols Rounded)
export const AlertTriangle = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="warning" {...props} />
export const ArrowDown = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="arrow_downward" {...props} />
export const ArrowLeft = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="arrow_back" {...props} />
export const ArrowRight = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="arrow_forward" {...props} />
export const ArrowUp = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="arrow_upward" {...props} />
export const Bold = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="format_bold" {...props} />
export const BookOpen = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="menu_book" {...props} />
export const CheckSquare = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="check_box" {...props} />
export const ChevronDown = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="expand_more" {...props} />
export const ChevronLeft = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="chevron_left" {...props} />
export const ChevronRight = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="chevron_right" {...props} />
export const ChevronUp = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="expand_less" {...props} />
export const Clock = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="schedule" {...props} />
export const Code = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="code" {...props} />
export const Code2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="code" {...props} />
export const Columns2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="vertical_split" {...props} />
export const Compass = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="explore" {...props} />
export const Eye = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="visibility" {...props} />
export const EyeOff = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="visibility_off" {...props} />
export const File = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="article" {...props} />
export const FileCode2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="code" {...props} />
export const FileJson = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="data_object" {...props} />
export const FilePlus2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="note_add" {...props} />
export const FileType = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="text_fields" {...props} />
export const FileWarning = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="warning" {...props} />
export const Folder = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="folder" {...props} />
export const FolderInput = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="drive_file_move" {...props} />
export const FolderOpen = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="folder_open" {...props} />
export const FolderTree = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="account_tree" {...props} />
export const GitBranch = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="alt_route" {...props} />
export const GitMerge = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="call_merge" {...props} />
export const HardDrive = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="storage" {...props} />
export const Heading2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="title" {...props} />
export const HelpCircle = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="help" {...props} />
export const Home = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="home" {...props} />
export const Info = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="info" {...props} />
export const KeyRound = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="key" {...props} />
export const Layers = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="layers" {...props} />
export const LayoutGrid = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="grid_view" {...props} />
export const Lightbulb = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="lightbulb" {...props} />
export const Link2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="link" {...props} />
export const ListPlus = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="playlist_add" {...props} />
export const ListTree = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="toc" {...props} />
export const LocateFixed = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="my_location" {...props} />
export const Lock = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="lock" {...props} />
export const MapIcon = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="map" {...props} />
export const Maximize2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="fullscreen" {...props} />
export const Minimize2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="fullscreen_exit" {...props} />
export const Move = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="open_with" {...props} />
export const Network = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="hub" {...props} />
export const PanelRight = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="view_sidebar" {...props} />
export const Pencil = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="edit" {...props} />
export const Pin = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="push_pin" {...props} />
export const PinOff = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="push_pin" {...props} />
export const Radar = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="radar" {...props} />
export const Redo2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="redo" {...props} />
export const Save = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="save" {...props} />
export const Search = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="search" {...props} />
export const Settings = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="settings" {...props} />
export const Share = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="ios_share" {...props} />
export const Shield = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="shield" {...props} />
export const ShieldAlert = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="warning" {...props} />
export const Tag = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="label" {...props} />
export const Undo2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="undo" {...props} />
export const Unlock = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="lock_open" {...props} />
export const UploadCloud = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="cloud_upload" {...props} />
export const Wand2 = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="auto_fix_high" {...props} />
export const WifiOff = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="wifi_off" {...props} />
export const ZoomIn = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="zoom_in" {...props} />
export const ZoomOut = (props: Omit<MaterialIconProps, 'name'>) => <MaterialIcon name="zoom_out" {...props} />
