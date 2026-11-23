export interface ImportableLibraryPayload {
  name?: string;
  url: string;
}

const HASH_PREFIX = 'import_lib='

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

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

/**
 * Decodes the `import_lib` value. New links use unpadded base64url (shorter, so the QR code is
 * less dense); older links used percent-encoded standard base64, and both still decode.
 */
function decodeImportPayload(encoded: string): ImportableLibraryPayload | null {
  try {
    const base64 = decodeURIComponent(encoded).replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = base64ToUtf8(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    if (!jsonStr) return null

    const parsed = JSON.parse(jsonStr) as Partial<ImportableLibraryPayload>
    if (!parsed || typeof parsed !== 'object' || typeof parsed.url !== 'string') return null
    if (!isHttpUrl(parsed.url.trim())) return null

    return {
      name: parsed.name ? String(parsed.name).trim() : undefined,
      url: parsed.url.trim(),
    }
  } catch (err) {
    console.warn('[hashImport] Failed to decode library payload:', err)
    return null
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
  const base64url = utf8ToBase64(payloadStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const origin = window.location.origin + window.location.pathname
  return `${origin}#${HASH_PREFIX}${base64url}`
}

/**
 * Reads a RepCard share link (from any RepCard origin, e.g. a scanned QR code or a pasted link).
 * Returns null when the text is not a share link.
 */
export function parseLibraryShareLink(text: string): ImportableLibraryPayload | null {
  try {
    const hash = new URL(text.trim()).hash.slice(1)
    return hash.startsWith(HASH_PREFIX) ? decodeImportPayload(hash.slice(HASH_PREFIX.length)) : null
  } catch {
    return null
  }
}

/**
 * Turns scanned QR text into something importable: a RepCard share link, or else a bare
 * http(s) endpoint URL. Returns null for anything else.
 */
export function parseScannedLibrary(text: string): ImportableLibraryPayload | null {
  const shared = parseLibraryShareLink(text)
  if (shared) return shared
  const trimmed = text.trim()
  return isHttpUrl(trimmed) ? { url: trimmed } : null
}

/**
 * Checks and parses #import_lib=<base64> from the current window.location.hash.
 */
export function checkUrlHashForLibrary(): ImportableLibraryPayload | null {
  const hash = window.location.hash.slice(1) // remove '#'
  if (!hash.startsWith(HASH_PREFIX)) return null
  return decodeImportPayload(hash.slice(HASH_PREFIX.length))
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
