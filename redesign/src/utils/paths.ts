/**
 * Utility to resolve site paths with proper base prefix
 * for both local dev (root '/') and GitHub Pages subpaths.
 */
export function p(pathStr: string): string {
  if (!pathStr) return pathStr;
  if (
    pathStr.startsWith('http://') ||
    pathStr.startsWith('https://') ||
    pathStr.startsWith('mailto:') ||
    pathStr.startsWith('tel:') ||
    pathStr.startsWith('#')
  ) {
    return pathStr;
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const clean = pathStr.startsWith('/') ? pathStr : `/${pathStr}`;
  return `${base}${clean}`;
}
