/** Color modes in cycle order (the drawer's palette button steps through them) */
export const COLOR_MODES = ['default', 'navy-canvas', 'black-navy-card'] as const
export type ColorPaletteMode = (typeof COLOR_MODES)[number]
