export function toSlug(str: string) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'dashboard';
}

export function toIdent(str: string) {
  let s = String(str || '').replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s || 'Item';
}

export function pascalCase(str: string) {
  return String(str || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Page';
}

// Stringify a JS value into source code (objects/arrays/primitives only).
// We just use JSON.stringify since everything from a dashboard is JSON-safe.
export function jsLiteral(value: unknown, indent: number = 2) {
  return JSON.stringify(value, null, indent);
}
