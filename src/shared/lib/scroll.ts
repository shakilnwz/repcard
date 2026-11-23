export function scrollToHeadingSlug(slug: string): boolean {
  if (typeof document === 'undefined' || !slug) return false;
  const decoded = decodeURIComponent(slug).toLowerCase();
  const el =
    document.getElementById(decoded) ??
    document.getElementById(`user-content-${decoded}`);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}
