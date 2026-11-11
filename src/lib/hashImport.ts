export interface ImportableLibraryPayload {
  name?: string;
  url: string;
}

function utf8ToBase64(str: string): string {
  try {
    return window.btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16)),
      ),
    )
  } catch {
    return ''
  }
}

function base64ToUtf8(str: string): string {
  try {
    return decodeURIComponent(
      window
        .atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
  } catch {
    return ''
  }
}

/**
 * Encodes a library endpoint into a private shareable hash link.
 * Example: https://repcard.pages.dev/#import_lib=eyJuYW1lIjoi...
 */
export function generateLibraryShareLink(library: ImportableLibraryPayload): string {
  const payloadStr = JSON.stringify({
    name: library.name?.trim(),
    url: library.url.trim(),
  })
  const base64 = utf8ToBase64(payloadStr)
  const origin = window.location.origin + window.location.pathname
  return `${origin}#import_lib=${encodeURIComponent(base64)}`
}

/**
 * Checks and parses #import_lib=<base64> from the current window.location.hash.
 */
export function checkUrlHashForLibrary(): ImportableLibraryPayload | null {
  try {
    const hash = window.location.hash.slice(1) // remove '#'
    if (!hash) return null

    const match = hash.match(/^import_lib=(.+)$/)
    if (!match || !match[1]) return null

    const base64 = decodeURIComponent(match[1])
    const jsonStr = base64ToUtf8(base64)
    if (!jsonStr) return null

    const parsed = JSON.parse(jsonStr) as Partial<ImportableLibraryPayload>
    if (!parsed || typeof parsed !== 'object' || !parsed.url || typeof parsed.url !== 'string') {
      return null
    }

    // Basic URL format validation
    const parsedUrl = new URL(parsed.url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null
    }

    return {
      name: parsed.name ? String(parsed.name).trim() : undefined,
      url: parsed.url.trim(),
    }
  } catch (err) {
    console.warn('[hashImport] Failed to parse library from hash:', err)
    return null
  }
}

/**
 * Removes #import_lib hash from the browser URL bar without triggering a reload.
 */
export function clearImportHash(): void {
  try {
    const cleanUrl = window.location.pathname + window.location.search
    window.history.replaceState(null, '', cleanUrl)
  } catch (err) {
    console.error('[hashImport] Could not clear URL hash:', err)
  }
}
